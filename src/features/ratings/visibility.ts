export type RatingVisibility = 'captains' | 'self' | 'members';
export function ratingVisibility(value: unknown): RatingVisibility {
  return value === 'self' || value === 'members' ? value : 'captains';
}
export function ratingVisibilityMessage(value: RatingVisibility) {
  return value === 'members' ? 'Los miembros del club pueden ver las valoraciones.' : value === 'self'
    ? 'Cada jugador puede ver las suyas; los capitanes pueden ver todas.' : 'Solo los capitanes del club pueden ver estas valoraciones.';
}
