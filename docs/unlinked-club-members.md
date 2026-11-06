# Miembros sin ficha

Solicitudes pendientes incluye un apartado para las cuentas con membresía activa que no tienen ninguna ficha de jugador vinculada en ese club. Una ficha inactiva sigue siendo una ficha vinculada. Se muestran el usuario y el rol, sin exponer correos electrónicos. Las cuentas de capitanes también aparecen; la cuenta propia no ofrece el botón de desvinculación.

Solo un capitán activo puede consultar la lista o confirmar una desvinculación. La operación bloquea el club y vuelve a comprobar que no se haya vinculado una ficha mientras el diálogo estaba abierto. Desactiva la membresía y rechaza las solicitudes pendientes de vinculación de esa cuenta en ese club; conserva su cuenta, otras membresías y los datos históricos. No permite desvincularse a uno mismo y conserva la protección del último capitán. Reintentar una operación ya completada no falla.

Pruebas: permisos de miembro, capitán, cuenta ajena y anónimo; ámbito de club; fichas inactivas y vinculación posterior a la carga; confirmación y cancelación en navegador; revocación de acceso y conservación de cuentas y fichas.

# Regreso desde convocatorias históricas

El historial abre cada convocatoria en `/historical-call-up`, dentro de la misma pila de gestión, reutilizando el contenido de la convocatoria. No cambia los parámetros ni la selección de la pestaña de convocatoria actual. El botón de regreso vuelve al historial; el regreso desde el historial conserva el origen (Inicio o Convocatoria). El gesto nativo y el botón de sistema utilizan esa misma pila. Una apertura directa sin historial de navegación vuelve a `/call-up-history`.

Pruebas de navegador recorren Inicio → Historial → Convocatoria histórica → Historial → Inicio y el mismo recorrido desde Convocatoria.
