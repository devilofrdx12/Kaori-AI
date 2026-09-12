import { Agent, fetch } from "undici";
import { lookup } from "node:dns/promises";

async function testFetch() {
  const targetUrl = "https://example.com";
  const urlObj = new URL(targetUrl);
  
  // Resolve DNS first (force ipv4 for the test since ipv6 timed out)
  const addresses = await lookup(urlObj.hostname, { all: true, family: 4 });
  const ip = addresses[0].address;
  console.log(`Resolved ${urlObj.hostname} to ${ip}`);

  const pinnedAgent = new Agent({
    connect: {
      lookup: (hostname, options, callback) => {
        console.log(`Custom lookup called for ${hostname}`);
        if (hostname === urlObj.hostname) {
          callback(null, [{ address: ip, family: 4 }]);
        } else {
          import("node:dns").then(dns => dns.lookup(hostname, options, callback));
        }
      }
    }
  });

  try {
    const res = await fetch(targetUrl, { dispatcher: pinnedAgent });
    console.log(`Fetch successful! Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response length: ${text.length}`);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testFetch();
