export interface ClassifiedError {
  error_type: string;
  message: string;
  detail: string;
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  type: string;
  message: (match: RegExpMatchArray, raw: string) => string;
}> = [
  {
    pattern: /Object (\S+) doesn't exist/i,
    type: "model_not_found",
    message: (m) => `모델 '${m[1]}'을(를) 찾을 수 없습니다`,
  },
  {
    pattern: /Invalid field '?([\w.]+)'? on '?(\S+?)'?$/m,
    type: "field_not_found",
    message: (m) => `모델 '${m[2]}'에 필드 '${m[1]}'이(가) 존재하지 않습니다`,
  },
  {
    pattern: /The method '(\S+?)\.(\w+)' does not exist/,
    type: "method_not_found",
    message: (m) => `모델 '${m[1]}'에 메서드 '${m[2]}'이(가) 존재하지 않습니다`,
  },
  {
    pattern: /Access Denied|AccessError|access.*denied/i,
    type: "access_denied",
    message: () => `접근 권한이 없습니다`,
  },
  {
    pattern: /ValidationError/,
    type: "validation_error",
    message: (_m, raw) => {
      // Extract the validation message from traceback
      const lines = raw.split("\n");
      const lastLine = lines[lines.length - 1]?.trim() || "";
      return `유효성 검사 실패: ${lastLine}`;
    },
  },
  {
    pattern: /timed out/i,
    type: "timeout",
    message: () => `요청 시간이 초과되었습니다`,
  },
  {
    pattern: /UserError/,
    type: "user_error",
    message: (_m, raw) => {
      const lines = raw.split("\n");
      const lastLine = lines[lines.length - 1]?.trim() || "";
      return lastLine || "사용자 오류가 발생했습니다";
    },
  },
];

export function classifyError(error: Error): ClassifiedError {
  const raw = error.message || "";

  for (const { pattern, type, message } of ERROR_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      return {
        error_type: type,
        message: message(match, raw),
        detail: raw,
      };
    }
  }

  // Unknown — extract last meaningful line from traceback
  const lines = raw.split("\n").filter((l) => l.trim());
  const lastLine = lines[lines.length - 1]?.trim() || raw;

  return {
    error_type: "unknown",
    message: lastLine,
    detail: raw,
  };
}
