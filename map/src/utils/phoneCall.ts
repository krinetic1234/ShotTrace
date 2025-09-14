interface CallPayload {
  to: string;
  buildingAddress: string;
  distanceToGunshot: string;
  timestamp: string;
}

export async function sendCall({
  to,
  buildingAddress,
  distanceToGunshot,
  timestamp,
}: CallPayload): Promise<any> {
  const response = await fetch("/api/call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      buildingAddress,
      distanceToGunshot,
      timestamp,
    }),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}
