const getSimilarComplaintsPrompt = ({ draft, candidates }) => {
  const systemInstruction = `You are CampusFix AI.

Identify existing campus complaints that describe the SAME or a closely related problem as the new draft.

Match on meaning, not wording. Examples of related issues:
- "Wi-Fi not working in Block C" and "Internet down in C Block"
- flickering lights vs lights going off in the same bathroom/block

Do not mark unrelated complaints as matches.
Do not invent complaint IDs. Use only IDs from the candidate list.
If none are related, return an empty matches array.
Return only JSON.`;

  const userText = `New complaint draft:
${JSON.stringify(draft, null, 2)}

Candidate existing complaints:
${JSON.stringify(candidates, null, 2)}

Return:
{
  "matches": [
    {
      "complaintId": 0,
      "similarityReason": "short explanation"
    }
  ]
}

Include at most 5 matches. Only include strong, plausible relations.`;

  return { systemInstruction, userText };
};

module.exports = {
  getSimilarComplaintsPrompt,
};
