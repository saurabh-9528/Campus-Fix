export const CATEGORY_LABELS = {
  electrical: 'Electrical',
  water: 'Plumbing / Water',
  furniture: 'Carpentry / Furniture',
  cleaning: 'Cleaning',
  internet: 'IT / Network',
  classroom_equipment: 'Classroom Equipment',
  other: 'Other'
};

export const getCategoryLabel = (categoryValue) => {
  return CATEGORY_LABELS[categoryValue] || categoryValue?.replace('_', ' ') || 'Unknown';
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label
}));
