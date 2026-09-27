export const getMethodColor = (method: string) => {
  const m = method.toLowerCase();
  if (m === 'get') return 'text-method-get';
  if (m === 'post') return 'text-method-post';
  if (m === 'delete') return 'text-method-delete';
  if (m === 'put') return 'text-method-put';
  if (m === 'patch') return 'text-method-patch';
  return 'text-text-primary';
};
