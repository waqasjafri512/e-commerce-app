const getProductFilters = query => {
  const filter = { isActive: true };

  if (query.category) filter.category = query.category;
  if (query.brand) filter.brand = query.brand;
  if (query.size) filter.size = query.size;
  if (query.color) filter.color = query.color;

  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }

  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
      { brand: { $regex: query.search, $options: 'i' } }
    ];
  }

  return filter;
};

const getSortOption = sort => {
  const sortMap = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    rating_desc: { averageRating: -1 },
    popular: { reviewCount: -1 }
  };

  return sortMap[sort] || { createdAt: -1 };
};

module.exports = {
  getProductFilters,
  getSortOption
};
