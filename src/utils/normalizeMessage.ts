export const normalizeMessage = (raw: string): string => {
  if (typeof raw !== 'string') return '';

  let processedString: any = raw;

  // 1) Try to deserialize (remove duplicate quotes and convert \n to actual newline)
  try {
    processedString = JSON.parse(raw);
  } catch {
    // 2) Fallback: remove extra quotes and replace literal \n with space
    processedString = raw
      .replace(/^"+|"+$/g, '')   // quotes at start/end
      .replace(/\\n/g, '\n');     // convert escaped \n
  }

  // After JSON.parse, the result might not be a string.
  // Convert it to a string before further processing.
  if (typeof processedString !== 'string') {
    processedString = String(processedString);
  }

  // 3) Normalize, trim, and convert to uppercase
  return processedString
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
};
