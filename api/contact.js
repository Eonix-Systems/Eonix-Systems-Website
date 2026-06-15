const RESEND_API_URL = "https://api.resend.com/emails";
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "business@eonixsystems.com";
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function clean(value) {
  return String(value || "").trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function projectBriefHtml(data) {
  const rows = [
    ["Name", data.name],
    ["Email", data.email],
    ["Phone", data.phone || "Not provided"],
    ["Company / Team", data.team || "Not provided"],
    ["Project Type", data.projectType],
    ["Current Stage", data.currentStage],
    ["Timeline", data.timeline]
  ];

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#162033;">
      <h2 style="margin:0 0 16px;">New project brief received</h2>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:680px;">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="padding:8px 12px;border:1px solid #d9e1ec;font-weight:700;width:180px;">${escapeHtml(label)}</td>
            <td style="padding:8px 12px;border:1px solid #d9e1ec;">${escapeHtml(value)}</td>
          </tr>
        `).join("")}
      </table>
      <h3 style="margin:22px 0 8px;">Project Description</h3>
      <p style="white-space:pre-wrap;margin:0;">${escapeHtml(data.projectDescription)}</p>
    </div>
  `;
}

function autoReplyHtml(name) {
  const safeName = escapeHtml(name);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#162033;max-width:640px;">
      <p>Dear ${safeName || "there"},</p>
      <p>Thank you for contacting Eonix Systems. This is an automated confirmation that we have received your project query.</p>
      <p>Our engineering team will review the details and get back to you at the earliest with the next steps or any clarifications required.</p>
      <p style="margin-top:24px;">Regards,<br>Eonix Systems</p>
    </div>
  `;
}

async function sendEmail(payload) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${details}`);
  }
}

function readRequestBody(req) {
  if (typeof req.body === "object" && req.body) {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string" && req.body) {
    return Promise.resolve(JSON.parse(req.body));
  }

  return new Promise((resolve, reject) => {
    let rawBody = "";

    req.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 100000) {
        reject(new Error("Request body is too large."));
      }
    });

    req.on("end", () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  let payload;
  try {
    payload = await readRequestBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "Invalid request body." });
  }

  if (!payload || typeof payload !== "object") {
    return sendJson(res, 400, { error: "Invalid request body." });
  }

  if (clean(payload.website)) {
    return sendJson(res, 200, { ok: true });
  }

  const data = {
    name: clean(payload.name),
    email: clean(payload.email),
    phone: clean(payload.phone),
    team: clean(payload.team),
    projectType: clean(payload.projectType),
    currentStage: clean(payload.currentStage),
    timeline: clean(payload.timeline),
    projectDescription: clean(payload.projectDescription)
  };

  const missingRequired = [
    "name",
    "email",
    "projectType",
    "currentStage",
    "timeline",
    "projectDescription"
  ].filter((field) => !data[field]);

  if (missingRequired.length || !isEmail(data.email)) {
    return sendJson(res, 400, { error: "Please complete all required fields with a valid email address." });
  }

  if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL) {
    return sendJson(res, 500, { error: "Contact email service is not configured." });
  }

  try {
    await Promise.all([
      sendEmail({
        from: CONTACT_FROM_EMAIL,
        to: [CONTACT_TO_EMAIL],
        reply_to: data.email,
        subject: `New Eonix project brief from ${data.name}`,
        html: projectBriefHtml(data)
      }),
      sendEmail({
        from: CONTACT_FROM_EMAIL,
        to: [data.email],
        reply_to: CONTACT_TO_EMAIL,
        subject: "We have received your query | Eonix Systems",
        html: autoReplyHtml(data.name)
      })
    ]);

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return sendJson(res, 502, { error: "Unable to send the contact email right now." });
  }
};
