import { backendErrorMessage } from '../../lib/backend-result.ts';

export function activityErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === '23505') return 'No se pudo reincorporar: el EA ID o la cuenta vinculada entra en conflicto con otra ficha. Revisa los datos antes de intentarlo de nuevo.';
    if (error.code === 'PGRST116') return 'La ficha ya no está disponible o no tienes permiso para modificarla. Actualiza la plantilla.';
  }
  return backendErrorMessage(error);
}
