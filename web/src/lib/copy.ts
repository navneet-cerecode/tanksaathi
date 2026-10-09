import type { ResidentStatus } from "@tanksaathi/core";

export type Lang = "en" | "hi";

// Hindi strings need a native speaker's review before submission (ASSUMPTIONS.md A12).
export const residentCopy: Record<ResidentStatus, Record<Lang, { word: string; line: string }>> = {
  normal: {
    en: { word: "Normal", line: "Water supply is normal." },
    hi: { word: "सामान्य", line: "पानी की आपूर्ति सामान्य है।" },
  },
  conserve: {
    en: { word: "Use carefully", line: "Please use water carefully." },
    hi: { word: "सोच-समझकर", line: "कृपया पानी सोच-समझकर इस्तेमाल करें।" },
  },
  "refill-planned": {
    en: { word: "Refill planned", line: "The tank will be refilled at {time}." },
    hi: { word: "टंकी भरी जाएगी", line: "टंकी {time} बजे भरी जाएगी।" },
  },
  incident: {
    en: { word: "Being checked", line: "A possible leak is being checked. Please save water." },
    hi: { word: "जाँच जारी", line: "संभावित रिसाव की जाँच हो रही है। कृपया पानी बचाएँ।" },
  },
};

export const ui: Record<Lang, Record<string, string>> = {
  en: {
    stale: "This status may be out of date.",
    noData: "No readings yet for this building.",
    updated: "Updated",
    language: "हिन्दी में देखें",
  },
  hi: {
    stale: "यह जानकारी पुरानी हो सकती है।",
    noData: "इस भवन के लिए अभी कोई रीडिंग नहीं है।",
    updated: "अपडेट",
    language: "View in English",
  },
};
