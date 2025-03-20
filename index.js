const express = require("express");
const cors = require("cors");
const port = 4000;
const port2 = 5000;
const app = express();
const socketIO = require("socket.io");
const http = require("http");
const server = http.createServer(app);
const mysql = require("mysql");
const { table } = require("console");
const multer = require("multer")
const path = require("path")
const storage = multer.diskStorage({
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  }
})
let mesas = {};  
const fs = require("node:fs")

const frontendUrl = "https://cookeronconnection.com";


// app.use(multer({storage: storage, dest: path.join(__dirname, "./public/images")}).single("image"))
app.use(express.json())
// app.options('*', (req, res) => {
//   const allowedOrigins = [frontendUrl];
//   const origin = req.headers.origin;
//   if (allowedOrigins.includes(origin)) {
//     res.header("Access-Control-Allow-Origin", origin);
//   }
//   res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
//   res.header("Access-Control-Allow-Headers", "Content-Type");
//   res.send();
// });



// Middleware de registro de solicitudes
app.use((req, res, next) => {
  console.log('Solicitud recibida:', req.method, req.url);
  console.log('Cuerpo de la solicitud:', req.body);

  const allowedOrigins = [frontendUrl];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  next();
});

const corsOptions = {
  // origin: 'https://diningexperiencesource.shop', // Reemplaza con la URL de tu aplicación frontend
  origin:  [frontendUrl],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions))

// const io = socketIO(server, {
//   path: "/socket",
//   cors: corsOptions,
// });



const io = socketIO(server, {
  path: '/socket',
  cors: {
    origin: [frontendUrl],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,  // Permitir cookies y credenciales si es necesario
  },
});

server.listen(port, () => {
  console.log("servidor  conectado");
});

app.get("/", (req, res) => {
  res.send("el servidor funciona");
});



let mesasConectadas = new Map()
let clientTimeouts = new Map(); 

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);
  const sendMemoryInfo = () => {
    const memoryUsage = process.memoryUsage();
    
    const memoryData = {
      heapTotal: memoryUsage.heapTotal,  // Total memory allocated to V8's heap
      heapUsed: memoryUsage.heapUsed,    // Total memory currently used by V8's heap
      external: memoryUsage.external,    // Memory used by external resources (e.g., C++ bindings)
      rss: memoryUsage.rss,              // Resident Set Size (Total memory used by the process)
    };
  
    const body = {
      nameRestaurant: "burgerShop",
      serviceNumber: "1",
      data: memoryData
    };
  
    // Enviar la información de la memoria al frontend en tiempo real
    io.emit('memoryInfo', body);
  };


  socket.on('admin_conectado', () => {
    console.log('Admin solicitado, enviando información de la memoria...');
    
    // Ejecutar la función para enviar la información de la memoria
    sendMemoryInfo();
  });
    // mensajes de chat

  socket.on('mensajeChat', (mensaje) => {
    console.log("Mensaje del chat:", mensaje); // Verifica que este mensaje se muestre
    io.emit('nuevoMensaje', mensaje);
  });

const functionCookRequest = (data) => {
  io.emit("pedidoALaCocina", data);
console.log("pedido que se envia a la cocina", data)
}

  socket.on('nuevoPedido', (data) => {
   functionCookRequest(data)
  });

    socket.on('unirse_mesa', (tableNumber) => {
      socket.tableNumber = tableNumber
      mesasConectadas.set(socket.id, tableNumber);
      // startClientTimeout(socket);
      socket.join(tableNumber);
      io.emit('enviar_mesa_admin', tableNumber)
      console.log("SE HA UNIDO LA MESA NUMERO: " + tableNumber)
    
      resetClientTimeout(socket)
    });

    const resetClientTimeout = (socket) => {
      // Limpiar el timeout si ya existe
      if (clientTimeouts.has(socket.id)) {
        clearTimeout(clientTimeouts.get(socket.id));
        clientTimeouts.delete(socket.id);
      }
    
      // Establecer un nuevo timeout que desconectará al cliente después de 15 segundos sin actividad
      clientTimeouts.set(socket.id, setTimeout(() => {
        console.log(`Cliente desconectado por inactividad: ${socket.id}, mesa: ${socket.tableNumber}`);
    
        // Eliminar al cliente de la lista de mesas conectadas
        mesasConectadas.delete(socket.id);
    
        // Emitir evento de desconexión a todos
        io.emit("cliente_desconectado", socket.tableNumber); // Emitir evento a todos
        socket.emit('cliente_desconectado',  socket.tableNumber ); // Emitir evento solo al cliente
    
        // Desconectar al cliente
        // socket.disconnect();
      }, 61000)); // 15 segundos sin recibir un pong (inactividad)
    };

  
  
    socket.on('solicitar_mesero', (tableNumber) => {
      // io.to(tableNumber).emit('desactivar_boton_cliente');
      io.emit('solicitar_mesero', tableNumber);
      console.log("EL CLIENTE DE LA MESA " + tableNumber + " SU BOTON DEBE ESTAR DESACTIVADO Y EN EL ADMIN DEBE ESTAR ACTIVADO")
    
    });


    const stopPingPong = (socket) => {
      try {
        console.log(`Deteniendo el sistema de Ping-Pong para el cliente ${socket.id}`);
        
        // Limpiar el timeout si ya existe
        if (clientTimeouts.has(socket.id)) {
          clearTimeout(clientTimeouts.get(socket.id));
          clientTimeouts.delete(socket.id); // Eliminar del mapa
        }
    console.log(`Cliente ${socket.id} procesado por inactividad.`);
        } catch (error) {
        console.error('Error al detener el sistema de Ping-Pong: ', error);
      }
    };
    

    socket.on("custom_disconnect", (tableNumber) => {
      console.log('Conectado, tableNumber recibido:', tableNumber);
     socket.tableNumber = tableNumber
     stopPingPong(socket);
     clientTimeouts.delete(socket.id); 
     mesasConectadas.delete(socket.id);
io.to(socket.tableNumber).emit("cliente_desconectado", socket.tableNumber)

    }) 



    socket.on('ping', (data) => {
      try {
        console.log(`Ping recibido del cliente ${data.id}, mesa: ${data.tableNumber}`);
    
        // Respondemos con un pong al cliente
        socket.to(data.id).emit('pong', { tableNumber: data.tableNumber }); 
    
        // Reiniciar el temporizador de inactividad del cliente cada vez que se recibe un ping
        resetClientTimeout(socket);
      } catch (error) {
        console.error('Error al recibir el ping del cliente: ', error);
      }
    });


    socket.on("pedidoEnviado", (table) => {
     
      io.emit("pedidoRecibido", table);
    });
    
    
    socket.on('enviar_mesero', (tableNumber) => {


  io.emit('mesero_enviado', tableNumber); // Confirmar que el mesero fue enviado
console.log("SE HA ENVIADO UN MESERO A LA MESA " + tableNumber + " EL BOTON EN EL ADMIN DEBE DESACIVARSE Y EN EL CLIENTE ACTIVARSE")    
});
  });;

