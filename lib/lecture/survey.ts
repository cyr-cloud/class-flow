export type SurveyDisplay = "cards" | "bar" | "pie" | "donut";
export type SurveyContent = {
  id: string; type: "survey"; prompt: string; display: SurveyDisplay;
  options: string[]; multiple: boolean;
};
export type SurveyResponse = { slideId: string; responderId: string; text?: string; choices?: number[] };
export const SURVEY_COLORS = ["#795442", "#456276", "#667a45", "#a44747", "#765a8c", "#ad782e", "#327d79", "#9b5284", "#6669ad", "#6e7277"];
export function cleanSurvey(content: SurveyContent): SurveyContent {
  if (!["cards", "bar", "pie", "donut"].includes(content.display)) throw new Error("결과 표시 방식을 선택해 주세요.");
  if (typeof content.prompt !== "string" || !content.prompt.trim() || content.prompt.length > 160) throw new Error("질문을 160자 이내로 입력해 주세요.");
  if (typeof content.multiple !== "boolean") throw new Error("응답 방식을 확인해 주세요.");
  const options = content.display === "cards" ? [] : content.options;
  if (!Array.isArray(options) || (content.display !== "cards" && (options.length < 2 || options.length > 10)) || options.some(o => typeof o !== "string" || !o.trim() || o.trim().length > 100)) throw new Error("선택지는 2~10개, 각각 100자 이내로 입력해 주세요.");
  const clean = options.map(o => o.trim());
  if (new Set(clean).size !== clean.length) throw new Error("중복된 선택지를 수정해 주세요.");
  return { id: content.id, type: "survey", prompt: content.prompt.trim(), display: content.display, options: clean, multiple: content.display !== "cards" && content.multiple };
}
export function cleanSurveyResponse(content: SurveyContent, response: SurveyResponse): SurveyResponse {
  if (typeof response.responderId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(response.responderId)) throw new Error("응답을 확인해 주세요.");
  const base = { slideId: content.id, responderId: response.responderId };
  if (content.display === "cards") {
    if (typeof response.text !== "string") throw new Error("답변을 입력해 주세요.");
    const text = response.text.normalize("NFKC").replace(/\r\n?/g, "\n").trim();
    if (!text || text.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error("답변을 500자 이내로 입력해 주세요.");
    return { ...base, text };
  }
  const choices = response.choices;
  if (!Array.isArray(choices) || !choices.length || choices.length > content.options.length || (!content.multiple && choices.length !== 1) || choices.some(i => !Number.isInteger(i) || i < 0 || i >= content.options.length) || new Set(choices).size !== choices.length) throw new Error("선택할 항목을 확인해 주세요.");
  return { ...base, choices: [...choices].sort((a, b) => a - b) };
}
export function surveyCounts(content: SurveyContent, responses: SurveyResponse[]) {
  return content.options.map((label, index) => ({ label, count: responses.filter(r => r.slideId === content.id && r.choices?.includes(index)).length }));
}
