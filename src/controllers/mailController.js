require('dotenv').config();
const nodemailer = require('nodemailer');

const sendMail = (req, res) => {
  const { nombre, correo, mensaje } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Formulario Web" <${correo}>`,
    to: 'info.greenparkacademy@gmail.com',
    subject: `📩 Nuevo mensaje de ${nombre}`,
    html: `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f3; padding: 40px;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
      
      <div style="background-color: #2f4f4f; padding: 24px 30px;">
        <h2 style="color: #ffffff; margin: 0; font-weight: 500;">Nuevo mensaje desde GreenPark </h2>
      </div>

      <div style="padding: 30px;">
        <p style="color: #444; font-size: 14px; margin-top: 0;">Has recibido un mensaje desde el formulario de contacto del sitio web:</p>

        <table style="width: 100%; margin-top: 20px; font-size: 15px; color: #333;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Nombre:</td>
            <td style="padding: 8px 0;">${nombre}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Correo:</td>
            <td style="padding: 8px 0;">${correo}</td>
          </tr>
        </table>

        <div style="margin-top: 30px;">
          <p style="margin: 0 0 8px 0; font-weight: bold; color: #2f4f4f; font-size: 15px;">Mensaje:</p>
          <div style="background-color: #f0f4f0; font-size: 15px; padding: 16px; border-left: 4px solid #3b5d3b; color: #333; border-radius: 4px; white-space: pre-line;">
            ${mensaje}
          </div>
        </div>

        <p style="font-size: 13px; color: #777; margin-top: 40px;">Enviado el: ${new Date().toLocaleString()}</p>
      </div>

      <div style="background-color: #e0e4e0; padding: 15px; text-align: center; font-size: 13px; color: #666;">
        Este mensaje fue enviado automáticamente desde el sitio web de GreenPark.
      </div>

    </div>
  </div>
`


  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      return res.status(500).send('Error al enviar el correo.');
    } else {
      console.log('Correo enviado: ' + info.response);
      return res.status(200).send('Correo enviado exitosamente.');
    }
  });
};

module.exports = { sendMail };
