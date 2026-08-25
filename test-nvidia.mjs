async function run() {
  const apiKey = "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";
  const body = {
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    messages: [{ role: "user", content: "Hello" }],
    stream: true,
    max_tokens: 4096
  };

  const resp = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  console.log("Status:", resp.status);
  const text = await resp.text();
  console.log("Body:", text);
}

run();
