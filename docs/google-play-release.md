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

## Actualización 1.1.1 del 27 de noviembre de 2026

Se compiló Android **1.1.1 (28)**, EAS
`7666959e-c027-4071-b592-2c920ea6bbb7`, y se cargó mediante `google-draft`.
La carga terminó en EAS Submit `509edec4-39ec-4f4a-a01d-f1e361485b3f`.

Se verificó que la huella SHA-256 del archivo coincide con la de Google y se
promovió esa misma compilación a **production**, con notas en cuatro idiomas.
El edit `09037408706181594404` se validó y confirmó con
`changesNotSentForReview=false`. Una lectura posterior confirma producción
1.1.1 (28), `status: completed`; la aprobación de Google y la disponibilidad
pública son estados posteriores que no se deducen solo de ese campo.

El perfil `store-production` permite futuros envíos directos al canal de
producción. El perfil histórico `production` conserva su canal `alpha`;
no confundir el nombre del perfil con el canal de destino. Las notas de esta
actualización se añadieron en la promoción por API.

Véase [release-1.1.1.md](release-1.1.1.md) para validación y ambos envíos.
