import { backendErrorMessage } from '../../lib/backend-result.ts';

export function playerActivityCopy(isActive: boolean) {
  return isActive ? {
    title: 'Quitar de la plantilla',
    description: '¿Quieres quitar a este jugador de la plantilla? Sus convocatorias anteriores se conservarán.',
    confirmLabel: 'Quitar de la plantilla',
  } : {
    title: 'Reincorporar a la plantilla',
    description: '¿Quieres reincorporar a este jugador? Conservará su EA ID, dorsal, categoría y cuenta vinculada. Volverá al final de su categoría y solo se incluirá en nuevas convocatorias.',
    confirmLabel: 'Reincorporar',
  };
}

export function activityErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === '23505') return 'No se pudo reincorporar: el EA ID o la cuenta vinculada entra en conflicto con otra ficha. Revisa los datos antes de intentarlo de nuevo.';
    if (error.code === 'PGRST116') return 'La ficha ya no está disponible o no tienes permiso para modificarla. Actualiza la plantilla.';
  }
  return backendErrorMessage(error);
}
