export async function sendSlackRiskStatusChange(input: { riskId: string; description: string; fromStatus: string; toStatus: string }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `Risk status changed: ${input.description} (${input.riskId}) ${input.fromStatus} -> ${input.toStatus}`,
    }),
  });
}
