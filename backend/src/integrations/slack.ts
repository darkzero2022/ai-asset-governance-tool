export async function sendSlackMessage(text: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function sendSlackRiskStatusChange(input: {
  riskId: string;
  description: string;
  fromStatus: string;
  toStatus: string;
}) {
  await sendSlackMessage(
    `Risk status changed: ${input.description} (${input.riskId}) ${input.fromStatus} -> ${input.toStatus}`,
  );
}
