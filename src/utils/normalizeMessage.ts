export const normalizeMessage = (raw: string): string => {
  if (typeof raw !== 'string') return '';

  // 1) Try to deserialize (remove duplicate quotes and convert \n to actual newline)
  try {
    return JSON.parse(raw).trim();
  } catch {
    // 2) Fallback: remove extra quotes and replace literal \n with space
    return raw
      .replace(/^"+|"+$/g, '')   // quotes at start/end
      .replace(/\\n/g, '\n')     // convert escaped \n
      .trim();
  }
};
