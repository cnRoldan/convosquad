import type { Language } from '../i18n/runtime';

export const privacyContact = 'convosquad.soporte@gmail.com';
export const privacyUpdatedAt = '2026-10-19';
export const privacyController = 'Claudio Roldán Ramos';

type Policy = { intro: string; sections: { title: string; paragraphs: string[] }[]; providerLinks: { label: string; href: `https://${string}` }[] };
const providerLinks: Policy['providerLinks'] = [
  { label: 'Supabase', href: 'https://supabase.com/privacy' },
  { label: 'Supabase DPA', href: 'https://supabase.com/legal/dpa' },
  { label: 'Expo', href: 'https://expo.dev/privacy' },
  { label: 'Netlify', href: 'https://www.netlify.com/privacy/' },
  { label: 'Firebase', href: 'https://firebase.google.com/support/privacy' },
  { label: 'Google / Gmail', href: 'https://policies.google.com/privacy' },
  { label: 'Apple', href: 'https://www.apple.com/legal/privacy/' },
  { label: 'WhatsApp', href: 'https://www.whatsapp.com/legal/privacy-policy' },
];

export const privacyPolicies: Record<Language, Policy> = {
  es: {
    intro: 'Esta política explica cómo ConvoSquad trata los datos personales en la aplicación móvil y en convosquad.netlify.app. ConvoSquad organiza equipos de Clubes Pro y es independiente de Electronic Arts.',
    sections: [
      { title: '1. Responsable y contacto', paragraphs: [
        'El responsable del servicio es Claudio Roldán Ramos, particular establecido en España. Para consultas sobre privacidad o para ejercer tus derechos, escribe a convosquad.soporte@gmail.com.',
      ] },
      { title: '2. Cuenta y acceso', paragraphs: [
        'Tratamos el ID de jugador que introduces, un identificador interno de cuenta, tu idioma y las fechas de alta y acceso. La contraseña se envía al servicio de autenticación de Supabase mediante conexión cifrada y se almacena de forma protegida mediante hash; no se guarda como texto legible en las tablas de la app.',
        'El registro actual no pide un correo electrónico real: genera un identificador técnico a partir del ID de jugador. No accedemos a tu cuenta de Electronic Arts ni recibimos tu contraseña de EA. Si contactas con soporte, recibiremos el correo y la información que nos envíes.',
      ] },
      { title: '3. Datos de clubes y jugadores', paragraphs: [
        'Guardamos los nombres, descripciones, escudos y zonas horarias de los clubes; sus miembros, roles, solicitudes e invitaciones; los identificadores de jugadores, dorsales y posiciones; y las convocatorias, votos de disponibilidad y decisiones mantenidas. Los capitanes pueden añadir nombres de ayudas o pruebas, un teléfono opcional y observaciones. Estos datos pueden referirse a personas que no tienen cuenta.',
        'También guardamos las valoraciones de rendimiento introducidas por los capitanes, su fecha y las estadísticas calculadas a partir de ellas. No solicitamos datos de salud, documentos de identidad, ubicación precisa ni la agenda de contactos.',
        'Antes de añadir datos de otra persona, el capitán debe informarle y contar con una base legítima para hacerlo. El teléfono y las observaciones son opcionales; no deben incluir información sensible ni datos innecesarios para organizar el equipo.',
      ] },
      { title: '4. Quién puede ver la información', paragraphs: [
        'Los miembros autorizados acceden a la información de su propio club y a los votos de sus convocatorias. Solo el nombre y la descripción de los clubes marcados como públicos se muestran en el buscador público. Los escudos se sirven con acceso restringido a miembros.',
        'Los teléfonos y las observaciones de ayudas o pruebas solo son accesibles a los capitanes del club. Las valoraciones son privadas para capitanes por defecto; un capitán puede permitir que cada jugador vea las suyas o que las vean los miembros del club. El administrador técnico del servicio puede acceder a los datos cuando sea necesario para soporte, mantenimiento o seguridad.',
      ] },
      { title: '5. Notificaciones y almacenamiento del dispositivo', paragraphs: [
        'Si autorizas las notificaciones del sistema, tratamos un identificador aleatorio de instalación, un token de notificaciones, la plataforma del dispositivo y las preferencias de avisos. Conservamos los eventos y resultados de entrega necesarios para enviar avisos y evitar duplicados. El contenido puede incluir el ID de quien vota y su disponibilidad, y aparecer en la pantalla bloqueada según tus ajustes del sistema.',
        'Puedes gestionar los avisos desde la app y los permisos del sistema. En el dispositivo o navegador se conservan la sesión, el idioma, el club seleccionado, las preferencias de avisos y una caché de escudos para mantener el acceso y mejorar la carga. No se utilizan para publicidad personalizada.',
        'Al elegir un escudo, solo se sube la imagen seleccionada. Los servidores y proveedores pueden tratar datos técnicos de conexión, como IP, fecha, navegador o dispositivo y errores, para operar y proteger el servicio.',
      ] },
      { title: '6. Finalidades y bases jurídicas', paragraphs: [
        'Usamos los datos necesarios para prestar el servicio que solicitas: crear la cuenta, gestionar los clubes, sus permisos y convocatorias, registrar votos y mostrar valoraciones. La base jurídica es la ejecución de la relación de servicio (artículo 6.1.b del RGPD).',
        'Las funciones opcionales se activan cuando las solicitas; las notificaciones requieren además el permiso del sistema. Cuando el tratamiento requiera tu consentimiento, puedes retirarlo sin afectar a lo realizado previamente. La seguridad, la prevención de abusos y el diagnóstico técnico se basan en el interés legítimo de mantener un servicio seguro y fiable (artículo 6.1.f). Atendemos las obligaciones legales aplicables conforme al artículo 6.1.c.',
        'ConvoSquad no vende datos personales ni incorpora publicidad personalizada. La versión actual no procesa compras ni datos de tarjetas. Las valoraciones son introducidas por personas y no adoptamos decisiones automatizadas con efectos jurídicos sobre los jugadores.',
      ] },
      { title: '7. Proveedores y transferencias internacionales', paragraphs: [
        'Supabase proporciona autenticación, base de datos, archivos y funciones del servidor. La base de datos principal está alojada en la región eu-west-1 (Irlanda). Netlify aloja y distribuye la web. Expo gestiona el envío de notificaciones, que pueden pasar por Firebase Cloud Messaging de Google en Android o por Apple Push Notification service en iOS. Google/Gmail interviene cuando escribes al correo de soporte.',
        'Estos proveedores reciben los datos necesarios para sus funciones. Las notificaciones incluyen el token del dispositivo, identificadores del club, convocatoria y destinatario y, según el aviso, el nombre de jugador y su voto. Si pulsas el enlace de WhatsApp, se abre ese servicio con el teléfono seleccionado y se aplican sus propias condiciones; no le enviamos automáticamente toda la plantilla ni la agenda.',
        'Aunque la base principal esté en la UE, las redes globales y algunos proveedores pueden tratar datos fuera del Espacio Económico Europeo. Se aplican las garantías de sus acuerdos de tratamiento y los mecanismos previstos por el RGPD, como las cláusulas contractuales tipo o las decisiones de adecuación cuando correspondan. Puedes solicitar información adicional sobre los proveedores y garantías escribiendo al contacto de privacidad.',
      ] },
      { title: '8. Conservación y eliminación', paragraphs: [
        'La cuenta y sus preferencias se conservan mientras siga activa. Los datos de clubes, plantilla e historial se mantienen mientras se utilicen en el club, hasta que se eliminen mediante las funciones disponibles o se solicite su supresión. Las valoraciones consultables se limitan a los últimos tres meses y las anteriores se eliminan mediante una tarea diaria.',
        'Puedes eliminar tu cuenta desde Mis clubes → Eliminar mi cuenta o desde convosquad.netlify.app/delete-account. Se exige la contraseña y una confirmación del ID. Si eres el único capitán, primero tendrás que nombrar otro capitán o eliminar el club; soporte puede ayudarte si no puedes completar el proceso.',
        'La eliminación borra la cuenta y los datos vinculados, incluidas sus fichas, votos y valoraciones, preferencias y registros de dispositivos. Los clubes compartidos y los datos de otros jugadores se conservan. Los datos de ayudas o pruebas sin vínculo con una cuenta, así como referencias en textos libres, pueden requerir una solicitud al capitán o al correo de soporte para identificarlos y retirarlos.',
        'La supresión de registros activos no reescribe las copias de seguridad ni los registros operativos de los proveedores. Estos quedan sujetos a sus ciclos de rotación y conservación y no se usan para mantener activa una cuenta eliminada. Los mensajes de soporte y los registros de seguridad se conservan mientras sean necesarios para gestionar la consulta, investigar incidencias o atender responsabilidades legales; después deben suprimirse o anonimizarse. Puedes pedir información sobre los plazos aplicables a tu caso.',
      ] },
      { title: '9. Seguridad', paragraphs: [
        'Utilizamos conexiones HTTPS, autenticación y controles de acceso por club y rol. Los teléfonos y las notas privadas tienen permisos separados de los datos visibles para jugadores. Ningún sistema ofrece seguridad absoluta: utiliza una contraseña exclusiva, protege tu dispositivo y evita compartir invitaciones o credenciales con personas no autorizadas.',
      ] },
      { title: '10. Tus derechos', paragraphs: [
        'Puedes solicitar acceso, rectificación, supresión, limitación, oposición y portabilidad cuando correspondan, así como retirar un consentimiento. Escribe a convosquad.soporte@gmail.com e indica el ID de jugador y los datos afectados; para ayudarte a acreditar tu identidad solicitaremos solo la información necesaria. La solicitud se atiende, con carácter general, en un mes, con las ampliaciones previstas legalmente.',
        'Si no tienes cuenta y un capitán ha introducido tus datos, también puedes ejercer estos derechos. Puedes presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es) o ante la autoridad competente de tu lugar de residencia.',
      ] },
      { title: '11. Edad del público', paragraphs: [
        'ConvoSquad está dirigida a personas de 16 años en adelante. Actualmente no se solicita una fecha de nacimiento ni se realiza una verificación automática de edad. Si detectas datos de una persona menor de 16 años, contacta con soporte para que podamos revisar la situación y atender la solicitud de retirada que corresponda.',
      ] },
      { title: '12. Cambios de esta política', paragraphs: [
        'Publicaremos los cambios en esta misma página con su fecha de actualización. Si incorporamos nuevas finalidades, compras u otros tratamientos relevantes, actualizaremos esta información y solicitaremos los consentimientos adicionales que resulten necesarios.',
      ] },
    ], providerLinks,
  },
  en: {
    intro: 'This policy explains how ConvoSquad processes personal data in its mobile app and at convosquad.netlify.app. ConvoSquad organises Pro Clubs teams and is independent of Electronic Arts.',
    sections: [
      { title: '1. Controller and contact', paragraphs: [
        'The service is operated by Claudio Roldán Ramos, an individual based in Spain. For privacy questions or to exercise your rights, contact convosquad.soporte@gmail.com.',
      ] },
      { title: '2. Account and sign-in', paragraphs: [
        'We process the player ID you enter, an internal account identifier, your language and registration and sign-in dates. Your password is transmitted to Supabase authentication over an encrypted connection and stored securely as a hash, not as readable text in the app’s tables.',
        'Current registration does not request a real email address: it generates a technical identifier from your player ID. We do not access your Electronic Arts account or receive your EA password. If you contact support, we receive your email address and the information you send.',
      ] },
      { title: '3. Club and player data', paragraphs: [
        'We store club names, descriptions, crests and time zones; memberships, roles, requests and invitations; player identifiers, shirt numbers and positions; and call-ups, availability votes and retained decisions. Captains can add helper or trial player names, an optional phone number and notes. This information may concern people without an account.',
        'We also store performance ratings entered by captains, their dates and statistics calculated from them. We do not request health data, identity documents, precise location or your address book.',
        'Before adding another person’s information, captains must inform them and have a lawful basis for doing so. Phone numbers and notes are optional and must not include sensitive information or details unnecessary for organising the team.',
      ] },
      { title: '4. Who can see the information', paragraphs: [
        'Authorised members can access their own club’s information and call-up votes. Only the name and description of clubs marked public appear in public search. Access to club crests is restricted to members.',
        'Helper and trial phone numbers and notes are accessible only to that club’s captains. Ratings are private to captains by default; a captain can allow players to see their own ratings or share them with club members. The service’s technical administrator may access data as needed for support, maintenance or security.',
      ] },
      { title: '5. Notifications and device storage', paragraphs: [
        'If you allow system notifications, we process a random installation identifier, notification token, device platform and notification preferences. We retain events and delivery results needed to send alerts and prevent duplicates. Alerts may include a voter’s player ID and availability and may appear on the lock screen, depending on your system settings.',
        'You can manage alerts in the app and in system permissions. Your device or browser stores the session, language, selected club, notification preferences and a crest cache to maintain access and improve loading. They are not used for personalised advertising.',
        'When you select a crest, only the selected image is uploaded. Servers and providers may process technical connection data such as IP address, time, browser or device details and errors to operate and protect the service.',
      ] },
      { title: '6. Purposes and legal bases', paragraphs: [
        'We use data necessary to provide the service you request: creating an account, managing clubs, permissions and call-ups, recording votes and displaying ratings. The legal basis is performance of the service relationship (GDPR Article 6(1)(b)).',
        'Optional features are activated at your request; notifications also require system permission. Where processing requires consent, you may withdraw it without affecting earlier processing. Security, abuse prevention and technical diagnosis rely on our legitimate interest in a secure, reliable service (Article 6(1)(f)). Applicable legal obligations are handled under Article 6(1)(c).',
        'ConvoSquad does not sell personal data or include personalised advertising. The current version does not process purchases or card details. Ratings are entered by people; we do not make automated decisions with legal effects on players.',
      ] },
      { title: '7. Providers and international transfers', paragraphs: [
        'Supabase provides authentication, database, file storage and server functions. The primary database is hosted in eu-west-1 (Ireland). Netlify hosts and distributes the website. Expo handles notification delivery, which may use Google’s Firebase Cloud Messaging on Android or Apple Push Notification service on iOS. Google/Gmail is involved when you email support.',
        'Providers receive data necessary for their functions. Notifications contain the device token, club, call-up and recipient identifiers and, depending on the alert, a player name and vote. Tapping the WhatsApp link opens that service with the selected phone number under its own terms; we do not automatically send the entire roster or address book.',
        'Although the primary database is in the EU, global networks and some providers may process data outside the European Economic Area. Safeguards in their processing agreements and mechanisms under the GDPR apply, such as standard contractual clauses or adequacy decisions where applicable. You can request more information about providers and safeguards from the privacy contact.',
      ] },
      { title: '8. Retention and deletion', paragraphs: [
        'Your account and preferences are kept while active. Club, roster and historical data are kept while used by the club, until deleted through available features or following an erasure request. Viewable ratings cover the latest three months; older ratings are deleted by a daily task.',
        'You can delete your account through My clubs → Delete my account or at convosquad.netlify.app/delete-account. A password and confirmation of the player ID are required. If you are the only captain, appoint another captain or delete the club first; support can help if you cannot complete the process.',
        'Deletion removes the account and linked records, including player entries, votes, ratings, preferences and device registrations. Shared clubs and other players’ data remain. Helper or trial details not linked to an account, and references in free text, may require contacting a captain or support so that they can be identified and removed.',
        'Deleting active records does not rewrite providers’ backups or operational logs. These follow their rotation and retention cycles and are not used to keep a deleted account active. Support messages and security records are kept as needed to handle the enquiry, investigate incidents or meet legal responsibilities, then must be deleted or anonymised. You may request information on the periods applicable to your situation.',
      ] },
      { title: '9. Security', paragraphs: [
        'We use HTTPS, authentication and club- and role-based access controls. Phone numbers and private notes have permissions separate from player-visible data. No system is completely secure: use a unique password, protect your device and avoid sharing invitations or credentials with unauthorised people.',
      ] },
      { title: '10. Your rights', paragraphs: [
        'You may request access, rectification, erasure, restriction, objection and portability where applicable, and withdraw consent. Email convosquad.soporte@gmail.com with your player ID and the data concerned. We will request only information necessary to verify your identity. Requests are generally handled within one month, subject to legally permitted extensions.',
        'These rights also apply if you have no account and a captain entered your information. You may complain to the Spanish Data Protection Agency (www.aepd.es) or the competent authority where you live.',
      ] },
      { title: '11. Intended age group', paragraphs: [
        'ConvoSquad is intended for people aged 16 and over. We do not currently request a date of birth or automatically verify age. If you identify data relating to someone under 16, contact support so that we can review the situation and handle any appropriate removal request.',
      ] },
      { title: '12. Changes to this policy', paragraphs: [
        'We will publish changes on this page with an updated date. If we introduce new purposes, purchases or other significant processing, we will update this information and obtain any additional consent required.',
      ] },
    ], providerLinks,
  },
  de: {
    intro: 'Diese Erklärung beschreibt die Verarbeitung personenbezogener Daten durch ConvoSquad in der mobilen App und auf convosquad.netlify.app. ConvoSquad organisiert Pro-Clubs-Teams und ist unabhängig von Electronic Arts.',
    sections: [
      { title: '1. Verantwortlicher und Kontakt', paragraphs: [
        'Verantwortlich ist Claudio Roldán Ramos, eine Privatperson mit Sitz in Spanien. Bei Datenschutzfragen oder zur Ausübung deiner Rechte schreibe an convosquad.soporte@gmail.com.',
      ] },
      { title: '2. Konto und Anmeldung', paragraphs: [
        'Wir verarbeiten die eingegebene Spieler-ID, eine interne Kontokennung, deine Sprache sowie Registrierungs- und Anmeldedaten. Das Passwort wird verschlüsselt an den Authentifizierungsdienst von Supabase übertragen und als geschützter Hash gespeichert, nicht als lesbarer Text in den Tabellen der App.',
        'Die aktuelle Registrierung fragt keine echte E-Mail-Adresse ab, sondern erzeugt eine technische Kennung aus der Spieler-ID. Wir greifen weder auf dein Electronic-Arts-Konto zu noch erhalten wir dein EA-Passwort. Bei einer Supportanfrage erhalten wir deine E-Mail-Adresse und die mitgesendeten Informationen.',
      ] },
      { title: '3. Club- und Spielerdaten', paragraphs: [
        'Gespeichert werden Clubnamen, Beschreibungen, Wappen und Zeitzonen; Mitgliedschaften, Rollen, Anfragen und Einladungen; Spielerkennungen, Rückennummern und Positionen sowie Aufgebote, Verfügbarkeitsstimmen und beibehaltene Entscheidungen. Kapitäne können Namen von Aushilfen oder Testspielern, eine optionale Telefonnummer und Notizen hinzufügen. Diese Angaben können auch Personen ohne Konto betreffen.',
        'Außerdem speichern wir von Kapitänen eingegebene Leistungsbewertungen, deren Datum und daraus berechnete Statistiken. Wir fragen keine Gesundheitsdaten, Ausweisdokumente, genaue Standortdaten oder Adressbücher ab.',
        'Bevor Kapitäne Daten anderer Personen eintragen, müssen sie diese informieren und über eine rechtmäßige Grundlage verfügen. Telefonnummern und Notizen sind optional und dürfen keine sensiblen oder für die Teamorganisation unnötigen Angaben enthalten.',
      ] },
      { title: '4. Sichtbarkeit der Informationen', paragraphs: [
        'Berechtigte Mitglieder sehen die Informationen ihres eigenen Clubs und die Stimmen zu dessen Aufgeboten. In der öffentlichen Suche erscheinen nur Name und Beschreibung öffentlich geschalteter Clubs. Wappen sind nur für Mitglieder zugänglich.',
        'Telefonnummern und Notizen zu Aushilfen oder Testspielern sind ausschließlich für die Kapitäne des Clubs zugänglich. Bewertungen sind standardmäßig nur für Kapitäne sichtbar. Ein Kapitän kann Spielern ihre eigenen Bewertungen anzeigen oder sie für Clubmitglieder freigeben. Die technische Administration kann bei Bedarf für Support, Wartung oder Sicherheit auf Daten zugreifen.',
      ] },
      { title: '5. Benachrichtigungen und Gerätespeicher', paragraphs: [
        'Bei erlaubten Systembenachrichtigungen verarbeiten wir eine zufällige Installationskennung, einen Benachrichtigungstoken, die Geräteplattform und Benachrichtigungseinstellungen. Wir speichern die für den Versand und die Vermeidung doppelter Nachrichten erforderlichen Ereignisse und Zustellergebnisse. Hinweise können die Spieler-ID und Verfügbarkeit einer abstimmenden Person enthalten und je nach Systemeinstellung auf dem Sperrbildschirm erscheinen.',
        'Hinweise lassen sich in der App und über die Systemberechtigungen verwalten. Auf dem Gerät oder im Browser werden Sitzung, Sprache, ausgewählter Club, Benachrichtigungseinstellungen und ein Wappen-Cache gespeichert, um den Zugang aufrechtzuerhalten und Ladezeiten zu verbessern. Sie werden nicht für personalisierte Werbung verwendet.',
        'Bei der Auswahl eines Wappens wird nur das ausgewählte Bild hochgeladen. Server und Anbieter können technische Verbindungsdaten wie IP-Adresse, Zeitpunkt, Browser- oder Geräteangaben und Fehler zur Bereitstellung und Absicherung des Dienstes verarbeiten.',
      ] },
      { title: '6. Zwecke und Rechtsgrundlagen', paragraphs: [
        'Wir verwenden die notwendigen Daten, um den angeforderten Dienst bereitzustellen: Kontoerstellung, Verwaltung von Clubs, Berechtigungen und Aufgeboten, Erfassung von Stimmen und Anzeige von Bewertungen. Rechtsgrundlage ist die Erfüllung des Dienstverhältnisses gemäß Artikel 6 Absatz 1 Buchstabe b DSGVO.',
        'Optionale Funktionen werden auf deinen Wunsch aktiviert; Benachrichtigungen erfordern zusätzlich die Systemberechtigung. Soweit eine Einwilligung erforderlich ist, kann sie mit Wirkung für die Zukunft widerrufen werden. Sicherheit, Missbrauchsprävention und technische Fehlerdiagnose beruhen auf unserem berechtigten Interesse an einem sicheren, zuverlässigen Dienst (Artikel 6 Absatz 1 Buchstabe f). Gesetzliche Pflichten erfüllen wir nach Artikel 6 Absatz 1 Buchstabe c.',
        'ConvoSquad verkauft keine personenbezogenen Daten und enthält keine personalisierte Werbung. Die aktuelle Version verarbeitet keine Käufe oder Kartendaten. Bewertungen werden von Menschen eingegeben; wir treffen keine automatisierten Entscheidungen mit rechtlicher Wirkung für Spieler.',
      ] },
      { title: '7. Anbieter und internationale Übermittlungen', paragraphs: [
        'Supabase stellt Authentifizierung, Datenbank, Dateispeicher und Serverfunktionen bereit. Die Hauptdatenbank befindet sich in eu-west-1 (Irland). Netlify hostet und verteilt die Website. Expo übernimmt Benachrichtigungen, die auf Android über Firebase Cloud Messaging von Google und auf iOS über den Apple Push Notification service laufen können. Google/Gmail ist beteiligt, wenn du den Support per E-Mail kontaktierst.',
        'Anbieter erhalten die für ihre Aufgaben erforderlichen Daten. Benachrichtigungen enthalten Gerätetoken, Kennungen von Club, Aufgebot und Empfänger sowie je nach Hinweis Spielernamen und Stimme. Der WhatsApp-Link öffnet den Dienst mit der ausgewählten Telefonnummer nach dessen eigenen Bedingungen; wir übermitteln nicht automatisch die gesamte Spielerliste oder dein Adressbuch.',
        'Trotz der Hauptdatenbank in der EU können globale Netzwerke und einzelne Anbieter Daten außerhalb des Europäischen Wirtschaftsraums verarbeiten. Es gelten die Garantien ihrer Auftragsverarbeitungsvereinbarungen und die Mechanismen der DSGVO, etwa Standardvertragsklauseln oder gegebenenfalls Angemessenheitsbeschlüsse. Weitere Informationen zu Anbietern und Garantien erhältst du über den Datenschutzkontakt.',
      ] },
      { title: '8. Aufbewahrung und Löschung', paragraphs: [
        'Konto und Einstellungen bleiben während der aktiven Nutzung gespeichert. Club-, Spielerlisten- und Verlaufsdaten bleiben bestehen, solange sie im Club verwendet werden, bis sie über verfügbare Funktionen oder aufgrund eines Löschantrags entfernt werden. Abrufbare Bewertungen umfassen die letzten drei Monate; ältere werden durch einen täglichen Auftrag gelöscht.',
        'Du kannst dein Konto unter Meine Clubs → Mein Konto löschen oder auf convosquad.netlify.app/delete-account löschen. Passwort und Bestätigung der Spieler-ID sind erforderlich. Bist du der einzige Kapitän, musst du zunächst einen anderen ernennen oder den Club löschen. Bei Schwierigkeiten hilft der Support.',
        'Gelöscht werden das Konto und verknüpfte Daten einschließlich Spielereinträgen, Stimmen, Bewertungen, Einstellungen und Geräteregistrierungen. Gemeinsame Clubs und Daten anderer Spieler bleiben erhalten. Nicht mit einem Konto verknüpfte Aushilfs- oder Testspielerdaten und Verweise in Freitexten erfordern gegebenenfalls eine Anfrage an einen Kapitän oder den Support, um sie zuzuordnen und zu entfernen.',
        'Die Löschung aktiver Datensätze verändert keine Sicherungskopien oder Betriebsprotokolle der Anbieter. Diese unterliegen deren Rotations- und Aufbewahrungszyklen und dienen nicht dazu, ein gelöschtes Konto aktiv zu halten. Supportnachrichten und Sicherheitsprotokolle bleiben so lange erhalten, wie es für Anfragen, Vorfalluntersuchungen oder gesetzliche Verantwortlichkeiten erforderlich ist; anschließend sind sie zu löschen oder zu anonymisieren. Du kannst die für deinen Fall geltenden Fristen erfragen.',
      ] },
      { title: '9. Sicherheit', paragraphs: [
        'Wir verwenden HTTPS, Authentifizierung und Zugriffsrechte nach Club und Rolle. Telefonnummern und private Notizen haben gesonderte Berechtigungen gegenüber spielersichtbaren Daten. Kein System ist absolut sicher: Verwende ein eigenes Passwort, schütze dein Gerät und teile Einladungen oder Zugangsdaten nur mit berechtigten Personen.',
      ] },
      { title: '10. Deine Rechte', paragraphs: [
        'Du kannst gegebenenfalls Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Datenübertragbarkeit verlangen sowie eine Einwilligung widerrufen. Schreibe mit deiner Spieler-ID und den betroffenen Angaben an convosquad.soporte@gmail.com. Zur Identitätsprüfung verlangen wir nur notwendige Informationen. Anfragen bearbeiten wir grundsätzlich innerhalb eines Monats, vorbehaltlich gesetzlich zulässiger Verlängerungen.',
        'Diese Rechte gelten auch ohne Konto, wenn ein Kapitän deine Daten eingetragen hat. Du kannst dich bei der spanischen Datenschutzbehörde (www.aepd.es) oder der zuständigen Behörde an deinem Wohnort beschweren.',
      ] },
      { title: '11. Alterszielgruppe', paragraphs: [
        'ConvoSquad richtet sich an Personen ab 16 Jahren. Aktuell fragen wir kein Geburtsdatum ab und prüfen das Alter nicht automatisch. Werden dir Daten einer Person unter 16 bekannt, kontaktiere den Support, damit wir den Sachverhalt prüfen und einen gegebenenfalls erforderlichen Löschantrag bearbeiten können.',
      ] },
      { title: '12. Änderungen dieser Erklärung', paragraphs: [
        'Änderungen veröffentlichen wir mit aktualisiertem Datum auf dieser Seite. Bei neuen Zwecken, Käufen oder anderen wesentlichen Verarbeitungen passen wir diese Informationen an und holen erforderliche zusätzliche Einwilligungen ein.',
      ] },
    ], providerLinks,
  },
  fr: {
    intro: 'Cette politique explique comment ConvoSquad traite les données personnelles dans son application mobile et sur convosquad.netlify.app. ConvoSquad organise les équipes de Clubs Pro et est indépendante d’Electronic Arts.',
    sections: [
      { title: '1. Responsable et contact', paragraphs: [
        'Le responsable du service est Claudio Roldán Ramos, un particulier établi en Espagne. Pour toute question de confidentialité ou pour exercer tes droits, écris à convosquad.soporte@gmail.com.',
      ] },
      { title: '2. Compte et connexion', paragraphs: [
        'Nous traitons l’identifiant de joueur saisi, un identifiant interne de compte, ta langue et les dates d’inscription et de connexion. Le mot de passe est transmis au service d’authentification Supabase par une connexion chiffrée et stocké sous forme de hachage sécurisé, jamais en texte lisible dans les tables de l’application.',
        'L’inscription actuelle ne demande pas d’adresse électronique réelle : elle génère un identifiant technique à partir de l’identifiant de joueur. Nous n’accédons pas à ton compte Electronic Arts et ne recevons pas ton mot de passe EA. Si tu contactes le support, nous recevons ton adresse électronique et les informations envoyées.',
      ] },
      { title: '3. Données des clubs et des joueurs', paragraphs: [
        'Nous conservons les noms, descriptions, écussons et fuseaux horaires des clubs ; les membres, rôles, demandes et invitations ; les identifiants de joueurs, numéros et postes ; ainsi que les convocations, votes de disponibilité et décisions conservées. Les capitaines peuvent ajouter les noms de renforts ou de joueurs à l’essai, un téléphone facultatif et des observations. Ces données peuvent concerner des personnes sans compte.',
        'Nous conservons aussi les évaluations saisies par les capitaines, leurs dates et les statistiques calculées à partir de celles-ci. Nous ne demandons pas de données de santé, de documents d’identité, de position précise ni d’accès au carnet de contacts.',
        'Avant d’ajouter les données d’une autre personne, le capitaine doit l’en informer et disposer d’une base légitime. Le téléphone et les observations sont facultatifs et ne doivent pas contenir de données sensibles ou inutiles à l’organisation de l’équipe.',
      ] },
      { title: '4. Qui peut consulter les informations', paragraphs: [
        'Les membres autorisés accèdent aux informations de leur propre club et aux votes de ses convocations. Seuls le nom et la description des clubs déclarés publics apparaissent dans la recherche publique. L’accès aux écussons est réservé aux membres.',
        'Les téléphones et les observations des renforts ou joueurs à l’essai sont accessibles uniquement aux capitaines du club. Les évaluations sont réservées aux capitaines par défaut ; un capitaine peut autoriser chaque joueur à voir les siennes ou les partager avec les membres. L’administrateur technique du service peut accéder aux données lorsque le support, la maintenance ou la sécurité le nécessitent.',
      ] },
      { title: '5. Notifications et stockage sur l’appareil', paragraphs: [
        'Si tu autorises les notifications du système, nous traitons un identifiant aléatoire d’installation, un jeton de notification, la plateforme de l’appareil et tes préférences. Nous conservons les événements et résultats d’envoi nécessaires aux notifications et à la prévention des doublons. Une notification peut contenir l’identifiant et la disponibilité du joueur ayant voté et apparaître sur l’écran verrouillé selon tes réglages.',
        'Tu peux gérer les notifications dans l’application et dans les autorisations du système. L’appareil ou le navigateur conserve la session, la langue, le club choisi, les préférences et un cache d’écussons pour maintenir l’accès et améliorer le chargement. Ils ne servent pas à la publicité personnalisée.',
        'Lorsque tu choisis un écusson, seule l’image sélectionnée est envoyée. Les serveurs et prestataires peuvent traiter des données techniques de connexion telles que l’adresse IP, l’heure, le navigateur ou l’appareil et les erreurs afin de fournir et protéger le service.',
      ] },
      { title: '6. Finalités et bases juridiques', paragraphs: [
        'Nous utilisons les données nécessaires au service demandé : créer le compte, gérer les clubs, autorisations et convocations, enregistrer les votes et afficher les évaluations. La base juridique est l’exécution de la relation de service (article 6, paragraphe 1, point b du RGPD).',
        'Les fonctions facultatives sont activées à ta demande ; les notifications nécessitent aussi l’autorisation du système. Lorsque le traitement exige un consentement, tu peux le retirer sans remettre en cause les traitements antérieurs. La sécurité, la prévention des abus et le diagnostic technique reposent sur l’intérêt légitime à fournir un service sûr et fiable (article 6, paragraphe 1, point f). Les obligations légales relèvent de l’article 6, paragraphe 1, point c.',
        'ConvoSquad ne vend pas de données personnelles et ne contient pas de publicité personnalisée. La version actuelle ne traite pas d’achats ni de coordonnées de carte bancaire. Les évaluations sont saisies par des personnes ; nous ne prenons pas de décisions automatisées ayant des effets juridiques sur les joueurs.',
      ] },
      { title: '7. Prestataires et transferts internationaux', paragraphs: [
        'Supabase fournit l’authentification, la base de données, le stockage de fichiers et les fonctions serveur. La base principale se trouve dans la région eu-west-1 (Irlande). Netlify héberge et distribue le site. Expo gère l’envoi des notifications, qui peuvent passer par Firebase Cloud Messaging de Google sur Android ou Apple Push Notification service sur iOS. Google/Gmail intervient lorsque tu écris au support.',
        'Les prestataires reçoivent les données nécessaires à leurs missions. Les notifications contiennent le jeton de l’appareil, les identifiants du club, de la convocation et du destinataire et, selon le message, un nom de joueur et son vote. Le lien WhatsApp ouvre ce service avec le téléphone choisi selon ses propres conditions ; nous n’envoyons pas automatiquement toute la liste des joueurs ni le carnet de contacts.',
        'Même si la base principale est située dans l’UE, les réseaux mondiaux et certains prestataires peuvent traiter des données hors de l’Espace économique européen. Les garanties de leurs accords de traitement et les mécanismes prévus par le RGPD s’appliquent, notamment les clauses contractuelles types ou les décisions d’adéquation lorsqu’elles sont applicables. Tu peux demander des précisions sur les prestataires et garanties au contact de confidentialité.',
      ] },
      { title: '8. Conservation et suppression', paragraphs: [
        'Le compte et ses préférences sont conservés tant qu’il reste actif. Les données des clubs, des effectifs et de l’historique sont conservées pendant leur utilisation par le club, jusqu’à leur suppression par les fonctions disponibles ou sur demande. Les évaluations consultables couvrent les trois derniers mois ; les plus anciennes sont supprimées par une tâche quotidienne.',
        'Tu peux supprimer ton compte depuis Mes clubs → Supprimer mon compte ou sur convosquad.netlify.app/delete-account. Le mot de passe et la confirmation de l’identifiant sont nécessaires. Si tu es le seul capitaine, nomme d’abord un autre capitaine ou supprime le club ; le support peut t’aider en cas de difficulté.',
        'La suppression retire le compte et ses données associées, dont les fiches de joueur, votes, évaluations, préférences et enregistrements d’appareils. Les clubs partagés et les données des autres joueurs sont conservés. Les données de renforts ou de joueurs à l’essai sans lien avec un compte, ainsi que les références en texte libre, peuvent nécessiter une demande au capitaine ou au support pour être identifiées et retirées.',
        'La suppression des données actives ne réécrit pas les sauvegardes ni les journaux opérationnels des prestataires. Ceux-ci suivent leurs cycles de rotation et de conservation et ne servent pas à maintenir actif un compte supprimé. Les messages de support et journaux de sécurité sont conservés le temps nécessaire au traitement de la demande, à l’examen des incidents ou aux responsabilités légales, puis doivent être supprimés ou anonymisés. Tu peux demander les durées applicables à ton cas.',
      ] },
      { title: '9. Sécurité', paragraphs: [
        'Nous utilisons HTTPS, l’authentification et des contrôles d’accès par club et rôle. Les téléphones et notes privées ont des autorisations distinctes des données visibles par les joueurs. Aucun système n’est totalement sûr : utilise un mot de passe unique, protège ton appareil et réserve invitations et identifiants aux personnes autorisées.',
      ] },
      { title: '10. Tes droits', paragraphs: [
        'Tu peux demander l’accès, la rectification, la suppression, la limitation, l’opposition et la portabilité lorsque ces droits s’appliquent, ainsi que retirer un consentement. Écris à convosquad.soporte@gmail.com en indiquant ton identifiant et les données concernées. Nous ne demanderons que les informations nécessaires pour vérifier ton identité. Les demandes sont généralement traitées dans un mois, sous réserve des prolongations légales.',
        'Ces droits s’appliquent aussi si tu n’as pas de compte et qu’un capitaine a saisi tes données. Tu peux déposer une réclamation auprès de l’Agence espagnole de protection des données (www.aepd.es) ou de l’autorité compétente de ton lieu de résidence.',
      ] },
      { title: '11. Public visé', paragraphs: [
        'ConvoSquad s’adresse aux personnes de 16 ans et plus. Nous ne demandons actuellement pas de date de naissance et ne vérifions pas automatiquement l’âge. Si tu identifies des données d’une personne de moins de 16 ans, contacte le support pour que nous puissions examiner la situation et traiter la demande de retrait appropriée.',
      ] },
      { title: '12. Modifications de cette politique', paragraphs: [
        'Les modifications seront publiées sur cette page avec une date actualisée. Si de nouvelles finalités, des achats ou d’autres traitements importants sont introduits, nous mettrons à jour ces informations et recueillerons les consentements supplémentaires nécessaires.',
      ] },
    ], providerLinks,
  },
};
