export type ApiError = {
  error: {
    code: string;
    message: string;
    message_key: string;
    correlation_id: string;
    request_id: string;
  };
};
