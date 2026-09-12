const getAdminInsightsPrompt = ({ question, data }) => {
  const systemInstruction = `You are CampusFix AI.

Answer the administrator's question ONLY using the supplied campus complaint data.

Do not invent statistics, locations, categories, or counts.
If the supplied data is insufficient to answer, say so clearly.
Explain the result clearly and concisely for campus operations staff.
Do not mention being an AI model unless asked.`;

  const userText = `Administrator question:
${question}

Supplied campus data (JSON):
${JSON.stringify(data, null, 2)}

Return JSON:
{
  "answer": "2-5 short paragraphs or bullet-style sentences",
  "usedDataSummary": "plain-text bullet list of the specific counts you used, one item per line starting with •"
}

usedDataSummary must only restate numbers that appear in the supplied data.`;

  return { systemInstruction, userText };
};

module.exports = {
  getAdminInsightsPrompt,
};
