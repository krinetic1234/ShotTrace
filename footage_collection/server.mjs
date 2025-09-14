import Fastify from 'fastify';
import fastifyWs from '@fastify/websocket';
import fastifyFormBody from '@fastify/formbody';
import { config as loadEnv } from 'dotenv';
import { Anthropic } from '@anthropic-ai/sdk';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';

// load env from one folder up
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../.env') });

// read env vars
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_SECRET;
const fromNumber = process.env.FROM_E164;
const toNumber = process.env.TO_E164;
const ngrokHttps = (process.env.TWILIO_NGROK || '').replace(/\/+$/, '');
const port = Number(process.env.TWILIO_PORT || 8080);
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

// guards
if (!ngrokHttps) throw new Error('missing TWILIO_NGROK');
if (!anthropicApiKey) throw new Error('missing ANTHROPIC_API_KEY');
if (!accountSid || !authToken) console.warn('twilio creds missing → outbound call disabled');
if (!fromNumber || !toNumber) console.warn('from/to numbers missing → outbound call disabled');

// derive ws url
const wsBase = ngrokHttps.replace(/^https:/, 'wss:');
const wsUrl = `${wsBase}/ws`;

// prompts and greetings in caps
const systemPrompt =
  'YOU ARE A HELPFUL VOICE ASSISTANT. SPEAK CLEARLY. SPELL OUT NUMBERS, FOR EXAMPLE TWENTY NOT 20. NO EMOJIS OR BULLETS.';
const welcomeGreeting =
  'HI! I AM A VOICE ASSISTANT POWERED BY TWILIO AND ANTHROPIC. HOW CAN I HELP?';

// init
const fastify = Fastify();
fastify.register(fastifyWs);
fastify.register(fastifyFormBody);
const anthropic = new Anthropic({ apiKey: anthropicApiKey });

// helper to mask secrets in logs
const mask = (s, keep = 4) => s ? s.slice(0, keep) + '…' : '';

// log startup summary
console.log('booting server');
console.log('env summary', {
  port,
  publicUrl: ngrokHttps,
  wsUrl,
  fromNumber,
  toNumber,
  accountSid: mask(accountSid),
  anthropicApiKey: anthropicApiKey ? 'set' : 'missing'
});

// function to call anthropic
async function getAiResponse(messages) {
  const start = Date.now();
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages
    });
    const elapsed = Date.now() - start;
    const block = resp?.content?.find?.(b => b.type === 'text');
    const text = block?.text || 'SORRY, I DID NOT CATCH THAT.';
    console.log('ai response ok', { tokens: resp?.usage?.output_tokens, ms: elapsed });
    return text;
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error('ai error', { ms: elapsed, message: err?.message || err });
    return 'I HIT AN ERROR. PLEASE TRY AGAIN.';
  }
}

// twiml endpoint
fastify.all('/twiml', async (req, reply) => {
  console.log('http /twiml', { method: req.method, ip: req.ip });
  reply.type('text/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="${wsUrl}" welcomeGreeting="${welcomeGreeting}" />
  </Connect>
</Response>`
  );
});

// status callback
fastify.post('/status', async (req, reply) => {
  console.log('http /status', {
    callSid: req.body?.CallSid,
    callStatus: req.body?.CallStatus,
    timestamp: req.body?.Timestamp
  });
  reply.code(200).send('ok');
});

// call endpoint (outbound)
if (accountSid && authToken && fromNumber && toNumber) {
  const client = twilio(accountSid, authToken);
  fastify.post('/call', async (req, reply) => {
    console.log('http /call → attempting outbound call');
    try {
      const call = await client.calls.create({
        to: toNumber,
        from: fromNumber,
        url: `${ngrokHttps}/twiml`,
        statusCallback: `${ngrokHttps}/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST'
      });
      console.log('twilio call created', { callSid: call.sid });
      reply.send({ callSid: call.sid });
    } catch (err) {
      console.error('twilio call error', err?.message || err);
      reply.code(500).send({ error: 'failed_to_create_call' });
    }
  });
} else {
  console.log('outbound call disabled due to missing config');
}

// websocket handler
const sessions = new Map(); // maps callSid to conversations

fastify.get('/ws', { websocket: true }, (ws) => {
  console.log('ws connection opened');
  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.warn('ws message not json, ignoring');
      return;
    }
    switch (msg.type) {
      case 'setup':
        ws.callSid = msg.callSid;
        sessions.set(ws.callSid, []);
        console.log('ws setup', { callSid: ws.callSid });
        break;
      case 'prompt':
        console.log('ws prompt', { callSid: ws.callSid, prompt: msg.voicePrompt });
        const convo = sessions.get(ws.callSid) || [];
        convo.push({ role: 'user', content: msg.voicePrompt });
        const aiText = await getAiResponse(convo);
        convo.push({ role: 'assistant', content: aiText });
        sessions.set(ws.callSid, convo);
        ws.send(JSON.stringify({ type: 'text', token: aiText, last: true }));
        console.log('ws sent response', { callSid: ws.callSid, chars: aiText.length });
        break;
      case 'interrupt':
        console.log('ws interrupt', { callSid: ws.callSid });
        break;
      default:
        console.warn('ws unknown type', msg?.type);
    }
  });
  ws.on('close', () => {
    console.log('ws closed', { callSid: ws.callSid });
    if (ws.callSid) sessions.delete(ws.callSid);
  });
  ws.on('error', (err) => {
    console.error('ws error', err?.message || err);
  });
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
