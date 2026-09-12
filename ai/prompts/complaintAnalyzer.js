const {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_DEPARTMENTS,
} = require("../constants");

const getComplaintAnalyzerPrompt = ({ text, title, location }) => {
  const systemInstruction = `You are CampusFix AI, an assistant for a campus complaint-management system.

Your task is to analyze a student's complaint.

You MUST choose category, priority and recommendedDepartment only from the allowed values supplied by the system.

Allowed categories: ${ALLOWED_CATEGORIES.join(", ")}
Allowed priorities: ${ALLOWED_PRIORITIES.join(", ")}
Allowed departments: ${ALLOWED_DEPARTMENTS.join(", ")}

Do not invent categories, priorities, or department names.
Do not submit a complaint. You only recommend values for the student to review.
Return only the requested structured JSON.`;

  const userText = `Analyze this campus complaint and return JSON with exactly these keys:
{
  "category": "",
  "priority": "",
  "recommendedDepartment": "",
  "summary": ""
}

Rules:
- summary must be one concise sentence (max 140 characters).
- priority High or Urgent only when safety, outage, or complete service failure is described.
- Use Medium for typical repair issues and Low for minor inconvenience.

Complaint title: ${title || "(none)"}
Location: ${location || "(not provided)"}
Complaint text:
${text}`;

  return { systemInstruction, userText };
};

module.exports = {
  getComplaintAnalyzerPrompt,
};
