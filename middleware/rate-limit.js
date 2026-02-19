const buckets = new Map();

module.exports = ({ windowMs, max, message }) => {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();

    if (!buckets.has(key)) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const bucket = buckets.get(key);
    if (now > bucket.resetAt) {
      bucket.count = 1;
      bucket.resetAt = now + windowMs;
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).render('429', {
        pageTitle: 'Too many requests',
        path: req.path,
        errorMessage: message || 'Too many requests. Try again later.'
      });
    }

    next();
  };
};
