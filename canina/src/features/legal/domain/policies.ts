/** Versiones de los textos legales: se guardan con cada consentimiento (prueba art. 7 RGPD). */
export const PRIVACY_POLICY_VERSION = "2026-10-v1";
export const CANCELLATION_POLICY_VERSION = "2026-10-v1";

export type LegalPage = { slug: string; title: string; sections: { heading: string; body: string }[] };

const company = "[RAZÓN SOCIAL], NIF [NIF], domicilio en [DIRECCIÓN], email [EMAIL]";

export const LEGAL_PAGES: Record<string, LegalPage> = {
  "aviso-legal": {
    slug: "aviso-legal",
    title: "Aviso legal",
    sections: [
      { heading: "Titular del sitio web (art. 10 LSSI-CE)", body: `Este sitio web es titularidad de ${company}. Inscrita en el Registro Mercantil de [CIUDAD], tomo [—], folio [—], hoja [—].` },
      { heading: "Condiciones de uso", body: "El acceso a la web es gratuito y atribuye la condición de usuario, que acepta estas condiciones. El usuario se compromete a hacer un uso lícito de los contenidos y del sistema de reservas." },
      { heading: "Propiedad intelectual", body: "Los contenidos, marcas, logotipos y fotografías (incluidas las imágenes «antes y después» publicadas con consentimiento) son titularidad del salón o de terceros autorizados." },
      { heading: "Responsabilidad", body: "El titular no se responsabiliza de interrupciones del servicio o errores técnicos ajenos a su control, sin perjuicio de los derechos del consumidor." },
      { heading: "Legislación aplicable", body: "Legislación española. Para consumidores, los juzgados de su domicilio." },
    ],
  },
  privacidad: {
    slug: "privacidad",
    title: "Política de privacidad",
    sections: [
      { heading: "Responsable del tratamiento", body: company },
      { heading: "Finalidades y base jurídica", body: "1) Gestionar tus citas, la ficha de tus mascotas y la facturación — ejecución de contrato (art. 6.1.b RGPD) y obligación legal fiscal (art. 6.1.c). 2) Enviarte recordatorios de cita por WhatsApp/email — ejecución de contrato. 3) Comunicaciones comerciales y uso de fotos de tu mascota en redes — solo con tu consentimiento expreso (art. 6.1.a), revocable en cualquier momento desde tu área privada." },
      { heading: "Datos de salud de la mascota", body: "Las alertas clínicas (alergias, cirugías, medicación) se refieren al animal, no a ti, y se usan exclusivamente para prestar el servicio con seguridad." },
      { heading: "Conservación", body: "Mientras seas cliente y, después, durante los plazos legales: facturas 6 años (art. 30 Código de Comercio) y 4 años a efectos tributarios (art. 66 LGT)." },
      { heading: "Destinatarios y encargados", body: "Proveedor de hosting en la UE, pasarela de mensajería (WhatsApp Business / email) y asesoría fiscal. No se realizan transferencias internacionales fuera del EEE sin garantías adecuadas." },
      { heading: "Derechos", body: "Acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [EMAIL]. Puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es)." },
    ],
  },
  cookies: {
    slug: "cookies",
    title: "Política de cookies",
    sections: [
      { heading: "¿Qué son?", body: "Archivos que se guardan en tu navegador para recordar información de tu visita." },
      { heading: "Cookies que usamos", body: "cania_session (técnica, sesión de usuario, 7 días). cania_cookie_consent (técnica, recuerda tu elección, 12 meses). Analíticas y de marketing: solo si las aceptas en el panel de configuración." },
      { heading: "Cómo cambiar tu elección", body: "Pulsa «Configurar cookies» en el pie de página en cualquier momento. Rechazar es tan fácil como aceptar, conforme a la Guía de la AEPD." },
    ],
  },
  cancelacion: {
    slug: "cancelacion",
    title: "Política de cancelación",
    sections: [
      { heading: "Cancelar o reprogramar", body: "Puedes cancelar o cambiar tu cita gratis desde tu área privada hasta 24 horas antes. Dentro de ese plazo, llámanos por teléfono." },
      { heading: "No presentados", body: "Tras dos ausencias sin aviso podremos solicitar confirmación telefónica previa a nuevas reservas online." },
      { heading: "Bonos", body: "Si cancelas a tiempo una cita pagada con bono, la sesión se devuelve automáticamente a tu bono." },
      { heading: "Perros con nudos o comportamiento no previsto", body: "Si el estado del manto o el comportamiento obligan a cambiar el servicio (p. ej. rapado por enredos), te avisaremos antes de continuar y el precio podrá ajustarse." },
    ],
  },
};
