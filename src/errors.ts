export interface ClassifiedError {
  error_type: string;
  error: string;
  detail?: string;
}

export function classifyError(message: string): ClassifiedError {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes("doesn't exist") || lowerMsg.includes("does not exist")) {
    const modelMatch = message.match(/Object (\S+) doesn't exist/);
    return {
      error_type: "model_not_found",
      error: modelMatch
        ? `모델 '${modelMatch[1]}'을(를) 찾을 수 없습니다. 모델명을 확인하거나 접근 권한을 확인하세요.`
        : "모델을 찾을 수 없습니다. 모델명 또는 접근 권한을 확인하세요.",
      detail: message,
    };
  }

  if (lowerMsg.includes("access denied") || lowerMsg.includes("accesserror")) {
    return {
      error_type: "access_denied",
      error: "접근 권한이 없습니다. 현재 사용자의 권한을 확인하세요.",
      detail: message,
    };
  }

  if (lowerMsg.includes("invalid field")) {
    const fieldMatch = message.match(/Invalid field '(\S+?)'/);
    const modelMatch = message.match(/on '(\S+?)'/);
    return {
      error_type: "field_not_found",
      error: fieldMatch
        ? `필드 '${fieldMatch[1]}'이(가) 모델${modelMatch ? ` '${modelMatch[1]}'` : ""}에 존재하지 않습니다. get_fields로 사용 가능한 필드를 확인하세요.`
        : "존재하지 않는 필드입니다. get_fields로 사용 가능한 필드를 확인하세요.",
      detail: message,
    };
  }

  if (lowerMsg.includes("missing") && lowerMsg.includes("record")) {
    return {
      error_type: "record_not_found",
      error: "요청한 레코드를 찾을 수 없습니다. ID를 확인하세요.",
      detail: message,
    };
  }

  if (lowerMsg.includes("validationerror") || lowerMsg.includes("validation error")) {
    return {
      error_type: "validation_error",
      error: "데이터 검증 오류가 발생했습니다.",
      detail: message,
    };
  }

  if (lowerMsg.includes("usererror")) {
    const userMsg = message.match(/UserError[:\s]*(.+?)(?:\n|$)/i);
    return {
      error_type: "user_error",
      error: userMsg ? `Odoo 사용자 에러: ${userMsg[1].trim()}` : "Odoo 사용자 에러가 발생했습니다.",
      detail: message.length > 500 ? message.slice(-500) : message,
    };
  }

  if (lowerMsg.includes("authentication failed")) {
    return {
      error_type: "auth_failed",
      error: "인증에 실패했습니다. ODOO_URL, ODOO_DB, 인증 정보를 확인하세요.",
      detail: message,
    };
  }

  // Traceback이 포함된 긴 에러 → 핵심만 추출
  if (message.includes("Traceback")) {
    const lines = message.split("\n");
    // Python traceback의 마지막 에러 라인 추출
    const errorLines = lines.filter((l) => /Error[:.]/.test(l) && !l.startsWith(" "));
    const lastError = errorLines.pop() || lines.filter((l) => l.trim() && !l.startsWith(" ")).pop() || message;
    return {
      error_type: "server_error",
      error: `Odoo 서버 에러: ${lastError.replace(/^.*?Error:\s*/, "").trim()}`,
      detail: message.length > 500 ? message.slice(-500) : message,
    };
  }

  return {
    error_type: "unknown",
    error: message,
  };
}
