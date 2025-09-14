// server.mjs
// deps: npm i fastify @fastify/formbody dotenv twilio ws @cerebras/cerebras_cloud_sdk
// run: node server.mjs  (ensure package.json has "type": "module")

import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import { config as loadEnv } from 'dotenv';
import twilio from 'twilio';
import { WebSocketServer } from 'ws';
import { Cerebras } from '@cerebras/cerebras_cloud_sdk';
import path from 'path';
import { fileURLToPath } from 'url';

// load env from one folder up
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../.env') });

// read env vars
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_SECRET;
const fromNumber = process.env.FROM_E164;
const ngrokHttps = (process.env.TWILIO_NGROK || '').replace(/\/+$/, '');
const port = Number(process.env.TWILIO_PORT || 8080);
const cerebrasApiKey = process.env.CEREBRAS_API_KEY;

// guards
if (!ngrokHttps) throw new Error('missing TWILIO_NGROK');
if (!cerebrasApiKey) throw new Error('missing CEREBRAS_API_KEY');
if (!accountSid || !authToken) console.warn('twilio creds missing → outbound call disabled');
if (!fromNumber) console.warn('from number missing → outbound call disabled');

// derive ws url
const wsBase = ngrokHttps.replace(/^https:/, 'wss:');
const wsUrl = `${wsBase}/ws`;

// init servers and clients
const fastify = Fastify();
fastify.register(fastifyFormBody);
const cerebras = new Cerebras({ apiKey: cerebrasApiKey });

// small helpers
const isE164 = (s) => typeof s === 'string' && /^\+[1-9]\d{1,14}$/.test(s);

// escape xml attribute values to avoid 12100 parse errors
const escapeAttr = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// per-call context storage (twilio CallSid → incident params)
const callMeta = new Map(); // { buildingAddress, distanceToGunshot, timestamp }

// build system prompt (sentence case)
function buildSystemPrompt(meta) {
  const { buildingAddress, distanceToGunshot, timestamp } = meta;
  return (
    `You are an investigator placing a courteous, professional outreach call regarding a recent incident. ` +
    `The target location is "${buildingAddress}". The reported distance to the gunshot is "${distanceToGunshot}". The relevant timestamp is "${timestamp}". ` +
    `Your goal is to request security camera footage covering a reasonable window around the timestamp. ` +
    `Style: Polite, concise, and factual. Do not use emojis or bullet points. ` +
    `Guidelines: ` +
    `1) Open by briefly explaining the incident context and why their location may have relevant footage. ` +
    `2) Ask if they can provide security footage covering a short window around the given time (for example, ten to fifteen minutes before and after). ` +
    `3) If willing, ask helpful details: Camera coverage areas (street entrances, parking, lobby), video retention, the timezone used on the system, and the preferred delivery method (a secure link or an email address). ` +
    `4) If they cannot help, thank them and ask if they know a building manager or security contact who might assist. ` +
    `5) Only when appropriate, mention that there may be witness testimonials indicating activity nearby, without disclosing sensitive details. ` +
    `6) Keep replies short (one to three sentences). ` +
    `7) Never claim legal authority; be clear this is a request for assistance. ` +
    `8) If asked how to share, suggest: "You can provide a secure link or email the clip; we can also accept a shared drive link." ` +
    `Output: Natural, polite dialogue in complete sentences.`
  );
}

// build welcome message (sentence case)
function buildWelcomeGreeting(meta) {
  const { buildingAddress, distanceToGunshot, timestamp } = meta;
  return (
    `There was a recent incident, and your building "${buildingAddress}" was reported within ${distanceToGunshot} of the location. ` +
    `Could you please share any security footage around ${timestamp}? Thank you.`
  );
}

// cerebras call (fixed defaults: model "gpt-oss-120b", 512 tokens, temp 0.2)
async function getAiResponse(messages, meta) {
  const fullMessages = [{ role: 'system', content: buildSystemPrompt(meta) }, ...messages];
  try {
    const resp = await cerebras.chat.completions.create({
      model: 'gpt-oss-120b',
      messages: fullMessages,
      max_completion_tokens: 512,
      temperature: 0.2
    });
    return resp?.choices?.[0]?.message?.content || 'Sorry, I did not catch that.';
  } catch (err) {
    console.error('cerebras error', err?.message || err);
    return 'I hit an error. Please try again.';
  }
}

// twiml endpoint (requires b, d, t)
fastify.all('/twiml', async (req, reply) => {
  const b = req.query?.b;
  const d = req.query?.d;
  const t = req.query?.t;
  if (!b || !d || !t) {
    reply.code(400).type('text/plain').send('missing required query params b,d,t');
    return;
  }

  const buildingAddress = String(b);
  const distanceToGunshot = String(d);
  const timestamp = String(t);

  const callSid = req.body?.CallSid || req.query?.CallSid;
  if (callSid) callMeta.set(callSid, { buildingAddress, distanceToGunshot, timestamp });

  const welcome = buildWelcomeGreeting({ buildingAddress, distanceToGunshot, timestamp });

  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="${escapeAttr(wsUrl)}" welcomeGreeting="${escapeAttr(welcome)}" />
  </Connect>
</Response>`;

  reply.type('text/xml').send(xml);
});

// status callback
fastify.post('/status', async (req, reply) => {
  console.log('status', req.body?.CallSid, req.body?.CallStatus, req.body?.Timestamp);
  reply.code(200).send('ok');
});

// outbound call (requires "to", buildingAddress, distanceToGunshot, timestamp)
if (accountSid && authToken && fromNumber) {
  const client = twilio(accountSid, authToken);
  fastify.post('/call', async (req, reply) => {
    const to = (req.body?.to || '').toString().trim();
    const buildingAddress = (req.body?.buildingAddress || '').toString().trim();
    const distanceToGunshot = (req.body?.distanceToGunshot || '').toString().trim();
    const timestamp = (req.body?.timestamp || '').toString().trim();

    if (!to || !isE164(to)) {
      return reply.code(400).send({ error: 'invalid_to_number', hint: 'Provide "to" in E.164, like "+14085551212".' });
    }
    if (!buildingAddress || !distanceToGunshot || !timestamp) {
      return reply.code(400).send({ error: 'missing_params', hint: 'Provide "buildingAddress", "distanceToGunshot", and "timestamp".' });
    }

    const twimlUrl =
      `${ngrokHttps}/twiml?` +
      `b=${encodeURIComponent(buildingAddress)}` +
      `&d=${encodeURIComponent(distanceToGunshot)}` +
      `&t=${encodeURIComponent(timestamp)}`;

    try {
      const call = await client.calls.create({
        to,
        from: fromNumber,
        url: twimlUrl,
        statusCallback: `${ngrokHttps}/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST'
      });
      reply.send({ callSid: call.sid });
    } catch (err) {
      console.error('twilio call error', err?.message || err);
      reply.code(500).send({ error: 'failed_to_create_call' });
    }
  });
} else {
  console.log('outbound call disabled due to missing config');
}

// minimal convo store
const sessions = new Map(); // callSid -> [{ role, content }]

// raw ws server (noServer mode)
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  console.log('ws open', req.socket.remoteAddress);

  ws.on('message', async (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    switch (msg.type) {
      case 'setup': {
        ws.callSid = msg.callSid;
        if (!callMeta.has(ws.callSid)) {
          // if twiml didn’t set meta, close to avoid undefined behavior
          ws.close();
          return;
        }
        sessions.set(ws.callSid, []);
        break;
      }
      case 'prompt': {
        const convo = sessions.get(ws.callSid) || [];
        const meta = callMeta.get(ws.callSid);
        convo.push({ role: 'user', content: msg.voicePrompt });
        const aiText = await getAiResponse(convo, meta);
        convo.push({ role: 'assistant', content: aiText });
        sessions.set(ws.callSid, convo);
        ws.send(JSON.stringify({ type: 'text', token: aiText, last: true }));
        break;
      }
      case 'interrupt':
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (ws.callSid) {
      sessions.delete(ws.callSid);
      callMeta.delete(ws.callSid);
    }
  });
});

// upgrade http → ws on /ws
fastify.server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

// start server
try {
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`server listening http://localhost:${port}`);
  console.log(`public url ${ngrokHttps}`);
  console.log(`ws url ${wsUrl}`);
} catch (err) {
  console.error('server failed to start', err);
  process.exit(1);
}
