const {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_DEPARTMENTS,
} = require("../constants");

const getImageAnalyzerPrompt = ({ text, title, location }) => {
  const systemInstruction = `You are CampusFix AI. Analyze campus evidence photos as an assessment, not as unquestionable truth.

You MUST choose category, priority and recommendedDepartment only from:
Categories: ${ALLOWED_CATEGORIES.join(", ")}
Priorities: ${ALLOWED_PRIORITIES.join(", ")}
Departments: ${ALLOWED_DEPARTMENTS.join(", ")}

If the image is unclear, unrelated, or not a campus issue, use category Other, priority Low, and say so in the summary.
Return only structured JSON.`;

  const userText = `Analyze this evidence image for a campus complaint.

Optional context:
Title: ${title || "(none)"}
Location: ${location || "(not provided)"}
Student description: ${text || "(none)"}

Return JSON:
{
  "category": "",
  "priority": "",
  "recommendedDepartment": "",
  "summary": "",
  "visualObservations": ["short observation", "short observation"]
}

visualObservations must be 1 to 4 short factual notes about what is visible.`;

  return { systemInstruction, userText };
};

module.exports = {
  getImageAnalyzerPrompt,
};
