# Subir un AAB sin publicar

El perfil `submit.google-draft` de `eas.json` carga una compilación existente al
canal interno de Google Play como **borrador** (`releaseStatus: draft`) y configura
`changesNotSentForReview: true`. No publica una versión de producción ni activa
un despliegue para los probadores.

```sh
npm run eas -- submit --platform android --profile google-draft \
  --id ID_DE_LA_COMPILACION_EAS --non-interactive --wait
```

Utiliza el identificador exacto de la compilación verificada, no `--latest`, para
evitar subir otro archivo. EAS utiliza la cuenta de servicio configurada en sus
servidores; no copiar sus claves al repositorio o a enlaces públicos.

Una vez que EAS indique `FINISHED`, en Google Play Console se puede seleccionar el
AAB desde **Producción → versión en borrador → Añadir de la biblioteca**. Esperar
al procesamiento de Google si todavía no aparece. Comprobar código de versión,
nombre de versión, notas y avisos antes de solicitar revisión o publicar.

La compilación preparada el 14 de noviembre de 2026 es **Android 1.1.0 (27)**,
build EAS `f63cb808-c1e9-4cf9-83bf-dc6fb1192fb2`, con SHA-256:

```text
ef41bb3822d24fe921bbc7e4b3eaa7b448f583e354c4a2d0997853ca73950b93
```

No generar otro AAB solo porque Google indique que el código de versión ya está
usado: primero localizar la compilación existente y reutilizarla en el lanzamiento
correspondiente. La confirmación de una subida de EAS no equivale a aprobación
de la app por Google ni a publicación en producción.
