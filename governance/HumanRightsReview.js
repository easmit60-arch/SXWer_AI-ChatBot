const REVIEW_RULES = Object.freeze([
  {
    id: "dehumanization",
    pattern: /\b(you people|those people|subhuman|disgusting)\b/gi,
    replacement: "people",
  },
  {
    id: "coercion",
    pattern:
      /\b(you must obey|you have to obey|there is only one right choice)\b/gi,
    replacement: "you have options and agency",
  },
  {
    id: "moralizing",
    pattern: /\b(dirty|immoral|shameful|asking for it)\b/gi,
    replacement: "harmful",
  },
  {
    id: "false-certainty",
    pattern: /\b(always|never|definitely|guaranteed)\b/gi,
    replacement: "often",
  },
  {
    id: "victim-blaming",
    pattern: /\b(your fault|you caused this|you invited this)\b/gi,
    replacement: "this is not your fault",
  },
]);

export function reviewHumanRightsText(input = "") {
  let text = String(input || "");
  const flags = [];

  for (const rule of REVIEW_RULES) {
    if (rule.pattern.test(text)) {
      flags.push(rule.id);
      text = text.replace(rule.pattern, rule.replacement);
    }
  }

  return Object.freeze({
    passed: flags.length === 0,
    flags: Object.freeze(flags),
    reviewedText: text,
  });
}

export function HumanRightsReview(responseObject = {}) {
  if (!responseObject || typeof responseObject !== "object") {
    return Object.freeze({ passed: true, flags: [], response: responseObject });
  }

  const reviewed = {};
  const mergedFlags = new Set();

  for (const [key, value] of Object.entries(responseObject)) {
    if (typeof value === "string") {
      const result = reviewHumanRightsText(value);
      reviewed[key] = result.reviewedText;
      result.flags.forEach((flag) => mergedFlags.add(flag));
    } else {
      reviewed[key] = value;
    }
  }

  return Object.freeze({
    passed: mergedFlags.size === 0,
    flags: Object.freeze(Array.from(mergedFlags)),
    response: Object.freeze(reviewed),
  });
}
