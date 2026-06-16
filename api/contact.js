const RESEND_API_URL = "https://api.resend.com/emails";
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "business@eonixsystems.com";
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_FILE_COUNT = 5;

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

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function projectBriefHtml(data, files = []) {
  const rows = [
    ["Name", data.name],
    ["Email", data.email],
    ["Company / Team", data.team || "Not provided"],
    ["Project Type", data.projectType],
    ["Project Stage", data.currentStage],
    ["Timeline", data.timeline],
    ["Attached Files", files.length ? files.map((file) => `${file.filename} (${formatBytes(file.size)})`).join(", ") : "None"]
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

function parseBodyString(rawBody, contentType = "") {
  const body = String(rawBody || "").replace(/^\uFEFF/, "").trim();
  if (!body) return {};

  if (contentType.includes("application/x-www-form-urlencoded") || body.includes("=")) {
    return Object.fromEntries(new URLSearchParams(body));
  }

  return JSON.parse(body);
}

function parseHeaderParams(value = "") {
  const params = {};
  const parts = value.split(";").map((part) => part.trim());
  params.type = parts.shift() || "";

  parts.forEach((part) => {
    const [key, ...rest] = part.split("=");
    if (!key || !rest.length) return;
    params[key.toLowerCase()] = rest.join("=").replace(/^"|"$/g, "");
  });

  return params;
}

function safeFilename(filename) {
  const cleaned = clean(filename)
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 120);

  return cleaned || "attachment";
}

function parseMultipartBody(buffer, contentType = "") {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch && (boundaryMatch[1] || boundaryMatch[2]);

  if (!boundary) {
    throw new Error("Missing multipart boundary.");
  }

  const fields = {};
  const files = [];
  const raw = buffer.toString("binary");
  const boundaryText = `--${boundary}`;
  const parts = raw.split(boundaryText).slice(1, -1);

  parts.forEach((part) => {
    let normalized = part;
    if (normalized.startsWith("\r\n")) normalized = normalized.slice(2);
    if (normalized.endsWith("\r\n")) normalized = normalized.slice(0, -2);

    const separatorIndex = normalized.indexOf("\r\n\r\n");
    if (separatorIndex === -1) return;

    const rawHeaders = normalized.slice(0, separatorIndex);
    const rawContent = normalized.slice(separatorIndex + 4);
    const headers = {};

    rawHeaders.split("\r\n").forEach((line) => {
      const index = line.indexOf(":");
      if (index === -1) return;
      headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
    });

    const disposition = parseHeaderParams(headers["content-disposition"]);
    const fieldName = disposition.name;
    if (!fieldName) return;

    const contentBuffer = Buffer.from(rawContent, "binary");
    if (disposition.filename !== undefined) {
      if (!contentBuffer.length) return;
      files.push({
        fieldName,
        filename: safeFilename(disposition.filename),
        contentType: headers["content-type"] || "application/octet-stream",
        size: contentBuffer.length,
        content: contentBuffer.toString("base64")
      });
      return;
    }

    fields[fieldName] = contentBuffer.toString("utf8").trim();
  });

  return { fields, files };
}

async function readRawBuffer(req, maxBytes = MAX_UPLOAD_BYTES + 250000) {
  if (req.body && Buffer.isBuffer(req.body)) {
    if (req.body.length > maxBytes) throw new Error("Request body is too large.");
    return req.body;
  }

  if (typeof req.body === "string") {
    const buffer = Buffer.from(req.body);
    if (buffer.length > maxBytes) throw new Error("Request body is too large.");
    return buffer;
  }

  if (typeof req[Symbol.asyncIterator] === "function") {
    const chunks = [];
    let totalLength = 0;

    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalLength += buffer.length;
      if (totalLength > maxBytes) {
        throw new Error("Request body is too large.");
      }
      chunks.push(buffer);
    }

    return Buffer.concat(chunks);
  }

  return new Promise((resolve, reject) => {
    if (typeof req.on !== "function") {
      resolve(Buffer.alloc(0));
      return;
    }

    const chunks = [];
    let totalLength = 0;

    req.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalLength += buffer.length;
      if (totalLength > maxBytes) {
        reject(new Error("Request body is too large."));
        return;
      }
      chunks.push(buffer);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readRequestBody(req) {
  const contentType = req.headers?.["content-type"] || req.headers?.["Content-Type"] || "";

  if (contentType.includes("multipart/form-data")) {
    return parseMultipartBody(await readRawBuffer(req), contentType);
  }

  if (req.body && Buffer.isBuffer(req.body)) {
    return { fields: parseBodyString(req.body.toString("utf8"), contentType), files: [] };
  }

  if (req.body && typeof req.body === "object") {
    return { fields: req.body, files: [] };
  }

  if (typeof req.body === "string") {
    return { fields: parseBodyString(req.body, contentType), files: [] };
  }

  return { fields: parseBodyString((await readRawBuffer(req, 100000)).toString("utf8"), contentType), files: [] };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = await readRequestBody(req);
  } catch (error) {
    return sendJson(res, error.message.includes("large") ? 413 : 400, { error: "Invalid request body." });
  }

  const payload = body.fields;
  const files = body.files || [];

  if (!payload || typeof payload !== "object") {
    return sendJson(res, 400, { error: "Invalid request body." });
  }

  if (clean(payload.website)) {
    return sendJson(res, 200, { ok: true });
  }

  const data = {
    name: clean(payload.name),
    email: clean(payload.email),
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

  const totalAttachmentBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (files.length > MAX_FILE_COUNT || totalAttachmentBytes > MAX_UPLOAD_BYTES) {
    return sendJson(res, 413, { error: "Please attach no more than 5 files and keep the total under 4 MB." });
  }

  if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL) {
    return sendJson(res, 500, { error: "Contact email service is not configured." });
  }

  try {
    const projectBriefEmail = {
      from: CONTACT_FROM_EMAIL,
      to: [CONTACT_TO_EMAIL],
      reply_to: data.email,
      subject: `New Eonix project brief from ${data.name}`,
      html: projectBriefHtml(data, files)
    };

    if (files.length) {
      projectBriefEmail.attachments = files.map((file) => ({
        filename: file.filename,
        content: file.content
      }));
    }

    await Promise.all([
      sendEmail(projectBriefEmail),
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
