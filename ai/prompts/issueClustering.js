const getIssueClusteringPrompt = ({ complaints }) => {
  const systemInstruction = `You are CampusFix AI.

Group unresolved campus complaints into thematic clusters of the SAME real-world issue.

Rules:
- A cluster must contain at least 2 genuinely related complaints.
- Match on meaning, not wording. Same location + same problem type is a strong signal.
- Do NOT force unrelated complaints into a cluster.
- Do NOT invent complaint IDs. Use only IDs from the supplied list.
- A complaint may appear in at most one cluster.
- If no genuine clusters exist, return an empty clusters array.
- Return only JSON.`;

  const userText = `Unresolved campus complaints:
${JSON.stringify(complaints, null, 2)}

Return:
{
  "clusters": [
    {
      "clusterLabel": "short title for the shared issue",
      "category": "one of the complaint categories",
      "commonLocation": "shared location if any, otherwise the most common location",
      "urgencyLevel": "Low or Medium or High",
      "complaintIds": [0],
      "summary": "one or two sentences explaining why these complaints belong together"
    }
  ]
}

Include at most 6 clusters. Each cluster must have at least 2 complaintIds from the list above.`;

  return { systemInstruction, userText };
};

module.exports = {
  getIssueClusteringPrompt,
};
