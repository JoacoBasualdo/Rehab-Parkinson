#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <U8g2lib.h>
#include <math.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>

// =======================================================
// PINES ESP32
// =======================================================

// Bus I2C principal: display + acelerometro derecho
#define SDA_PIN_DERECHA 21
#define SCL_PIN_DERECHA 22

// Bus I2C secundario: acelerometro izquierdo
#define SDA_PIN_IZQUIERDA 32
#define SCL_PIN_IZQUIERDA 33

#define BUZZER_PIN 25
#define BOTON_PIN 27

// =======================================================
// DIRECCIONES I2C
// =======================================================

// Como ahora estan en buses separados, ambos pueden usar 0x53.
// En ambos ADXL345:
// CS  -> 3V3
// SDO -> GND
#define DIRECCION_ADXL_DERECHA 0x53
#define DIRECCION_ADXL_IZQUIERDA 0x53

// =======================================================
// REGISTROS ADXL345 PARA LECTURA MANUAL DE IZQUIERDA
// =======================================================

#define REG_DEVID_ADXL345 0x00
#define VALOR_DEVID_ADXL345 0xE5

#define REG_POWER_CTL_ADXL345 0x2D
#define REG_DATA_FORMAT_ADXL345 0x31
#define REG_DATAX0_ADXL345 0x32

// FULL_RES = 1, rango +/-4g
#define ADXL345_DATA_FORMAT_4G_FULLRES 0x09

// Measure mode
#define ADXL345_MEASURE_MODE 0x08

// Conversion aproximada en full resolution:
// 3.9 mg/LSB * 9.81 = 0.03825 m/s^2 por LSB
#define ADXL345_M_S2_POR_LSB 0.03825

// =======================================================
// WIFI / APP WEB
// =======================================================

const char* WIFI_SSID = "Facu";
const char* WIFI_PASSWORD = "facucrack";

// Endpoint
const char* APP_ENDPOINT = "https://rehab-parkinson.onrender.com/api/wearable";
const char* DEVICE_ID = "ESP32_ADXL345_001";

// =======================================================
// WEBSOCKET PARA GRAFICO EN TIEMPO REAL
// =======================================================

// El ESP32 se conecta como CLIENTE WebSocket al servidor de Render.
// Este canal queda reservado para datos rapidos del grafico en tiempo real.
const char* WS_HOST = "rehab-parkinson.onrender.com";
const uint16_t WS_PORT = 443;
const char* WS_PATH = "/api/wearable-ws";

WebSocketsClient webSocket;
bool webSocketConectado = false;

bool wifiDisponible = false;

// Datos crudos para grafico por WebSocket.
// 100 ms = 10 mensajes por segundo. Si queres mas fluidez, probar 50 ms.
const unsigned long INTERVALO_ENVIO_WEARABLE_MS = 100;
unsigned long tiempoEnvioWearableAnterior = 0;

// =======================================================
// HTTP POST NO BLOQUEANTE PARA EVENTOS IMPORTANTES
// =======================================================

const bool ENVIO_APP_ACTIVO = true;

SemaphoreHandle_t mutexEnvioApp = NULL;
TaskHandle_t tareaEnvioAppHandle = NULL;

String jsonPendienteNormal = "";
String jsonPendientePrioritario = "";

bool hayJsonPendienteNormal = false;
bool hayJsonPendientePrioritario = false;

// =======================================================
// DISPLAY OLED SH1106 EN BUS DERECHO
// =======================================================

U8G2_SH1106_128X64_NONAME_F_HW_I2C display(
  U8G2_R0,
  U8X8_PIN_NONE,
  SCL_PIN_DERECHA,
  SDA_PIN_DERECHA
);

// =======================================================
// BUSES I2C Y ACELEROMETROS
// =======================================================

// Bus principal:
// Wire -> display + ADXL derecho

// Bus secundario:
// WireIzquierda -> ADXL izquierdo
TwoWire WireIzquierda = TwoWire(1);

// Derecho con libreria Adafruit sobre Wire
Adafruit_ADXL345_Unified adxlDerecha = Adafruit_ADXL345_Unified(12345);

bool acelerometroDerechoOK = false;
bool acelerometroIzquierdoConectado = false;

const unsigned long INTERVALO_VERIFICAR_IZQUIERDA_MS = 1000;
unsigned long tiempoVerificacionIzquierdaAnterior = 0;

// =======================================================
// CONFIGURACION DE MUESTREO
// =======================================================

const float FS = 50.0;
const unsigned long TS_MS = 20;
const int N = 100;

float muestrasXDerecha[N];
float muestrasYDerecha[N];
float muestrasZDerecha[N];

float muestrasXIzquierda[N];
float muestrasYIzquierda[N];
float muestrasZIzquierda[N];

int indiceBuffer = 0;
bool bufferCompleto = false;

unsigned long tiempoMuestreoAnterior = 0;
unsigned long tiempoAnalisisAnterior = 0;

const unsigned long INTERVALO_ANALISIS_MS = 500;

// =======================================================
// CONFIGURACION DE DETECCION DE TEMBLOR
// =======================================================

const float FREQ_MIN_TEMBLOR = 4.0;
const float FREQ_MAX_TEMBLOR = 6.0;

const float FREQ_BUSQUEDA_MIN = 2.0;
const float FREQ_BUSQUEDA_MAX = 10.0;
const float PASO_FREQ = 0.1;

const float UMBRAL_AMPLITUD = 0.15;

const unsigned long TIEMPO_MINIMO_DETECCION_MS = 5000;
const unsigned long TIEMPO_PERDIDA_PERMITIDA_MS = 1500;

// =======================================================
// VARIABLES ACELEROMETRO DERECHO
// =======================================================

float axDerecha = 0;
float ayDerecha = 0;
float azDerecha = 0;

float promedioXDerecha = 0;
float promedioYDerecha = 0;
float promedioZDerecha = 9.81;

float axDinamicaDerecha = 0;
float ayDinamicaDerecha = 0;
float azDinamicaDerecha = 0;

// =======================================================
// VARIABLES ACELEROMETRO IZQUIERDO
// =======================================================

float axIzquierda = 0;
float ayIzquierda = 0;
float azIzquierda = 0;

float promedioXIzquierda = 0;
float promedioYIzquierda = 0;
float promedioZIzquierda = 9.81;

float axDinamicaIzquierda = 0;
float ayDinamicaIzquierda = 0;
float azDinamicaIzquierda = 0;

// =======================================================
// FRECUENCIAS MANO DERECHA
// =======================================================

float freqXDerecha = 0;
float freqYDerecha = 0;
float freqZDerecha = 0;
float freqXYZDerecha = 0;

float ampXDerecha = 0;
float ampYDerecha = 0;
float ampZDerecha = 0;
float ampXYZDerecha = 0;

// =======================================================
// FRECUENCIAS MANO IZQUIERDA
// =======================================================

float freqXIzquierda = 0;
float freqYIzquierda = 0;
float freqZIzquierda = 0;
float freqXYZIzquierda = 0;

float ampXIzquierda = 0;
float ampYIzquierda = 0;
float ampZIzquierda = 0;
float ampXYZIzquierda = 0;

// =======================================================
// DETECCION GLOBAL
// =======================================================

float frecuenciaDetectada = 0;
float amplitudDetectada = 0;

String manoDominante = "-";
String canalDominante = "-";

bool frecuenciaEnRango = false;
bool episodioDetectado = false;

bool deteccionEnCurso = false;
unsigned long tiempoInicioDeteccion = 0;
unsigned long tiempoDeteccionSostenida = 0;
unsigned long tiempoUltimaDeteccionValida = 0;

// =======================================================
// BUZZER UNICO
// =======================================================

bool buzzerActivo = false;
unsigned long tiempoInicioBuzzer = 0;
const unsigned long DURACION_BUZZER_MS = 3000;

bool mostrarMensajeMovimiento = false;
bool alarmaBloqueada = false;
bool eventoValidadoEnviado = false;

// =======================================================
// BOTON
// =======================================================

bool estadoBotonAnterior = HIGH;
bool estadoBotonConfirmado = HIGH;

unsigned long ultimoCambioBoton = 0;
const unsigned long TIEMPO_ANTIRREBOTE_MS = 50;

// =======================================================
// PROTOTIPOS
// =======================================================

void conectarWiFi();

bool inicializarAcelerometroDerecho();
bool inicializarAcelerometroIzquierdo();
void verificarAcelerometroIzquierdo();

bool i2cPresente(TwoWire &bus, byte direccion);
bool escribirRegistroADXL(TwoWire &bus, byte direccion, byte registro, byte valor);
bool leerRegistroADXL(TwoWire &bus, byte direccion, byte registro, byte &valor);
bool adxl345PresenteEnBus(TwoWire &bus, byte direccion);
bool leerAceleracionADXLManual(TwoWire &bus, byte direccion, float &ax, float &ay, float &az);

void leerAcelerometros();
void leerAcelerometroDerecho();
void leerAcelerometroIzquierdo();

void limpiarDatosIzquierda();
void limpiarFrecuenciasIzquierda();

void guardarMuestras();
void limpiarBuffers();

void analizarFrecuencias();
void analizarCanal(float buffer[], float &frecuencia, float &amplitudDominante);
void analizarCanalCombinadoXYZ(float bufferX[], float bufferY[], float bufferZ[], float &frecuenciaXYZ, float &amplitudXYZ);

void verificarFrecuenciaEnRango();
void evaluarCanal(String mano, String canal, float frecuencia, float amplitud, float &mayorAmplitudValida);
void verificarDeteccionSostenida();

void controlarBuzzer();

void leerBoton();
void resetearSistemaPostEjercicio();

void mostrarMonitorSerial();
void mostrarDisplay();
void mostrarPantallaCargando();

void iniciarWebSocket();
void webSocketEvent(WStype_t type, uint8_t *payload, size_t length);
void enviarWebSocketGrafico(String json);

bool enviarJsonAApp(String json);
void tareaEnvioApp(void *parameter);
void dejarJsonPendiente(String json, bool prioritario);
void enviarDatosWearable();
void enviarAnalisisTemblor();
void enviarEventoValidado();
void enviarEjercicioCompletado();

float calcularMagnitudDinamicaDerecha();
float calcularMagnitudDinamicaIzquierda();

String obtenerSeveridad(float amplitud);
String obtenerClasificacion();
String crearTimestamp();

// =======================================================
// SETUP
// =======================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Iniciando sistema con 2 buses I2C...");

  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);

  pinMode(BOTON_PIN, INPUT_PULLUP);

  // Bus derecho: display + ADXL derecho
  Wire.begin(SDA_PIN_DERECHA, SCL_PIN_DERECHA);
  Wire.setClock(100000);
  Wire.setTimeOut(50);

  // Bus izquierdo: ADXL izquierdo
  WireIzquierda.begin(SDA_PIN_IZQUIERDA, SCL_PIN_IZQUIERDA);
  WireIzquierda.setClock(100000);
  WireIzquierda.setTimeOut(50);

  display.begin();
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);
  display.drawStr(0, 12, "Iniciando sistema");
  display.drawStr(0, 28, "Der: SDA21 SCL22");
  display.drawStr(0, 44, "Izq: SDA32 SCL33");
  display.sendBuffer();

  conectarWiFi();
  iniciarWebSocket();

  mutexEnvioApp = xSemaphoreCreateMutex();

  xTaskCreatePinnedToCore(
    tareaEnvioApp,
    "TareaEnvioApp",
    12000,
    NULL,
    1,
    &tareaEnvioAppHandle,
    0
  );

  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);

  if (WiFi.status() == WL_CONNECTED) {
    display.drawStr(0, 12, "WiFi conectado");
    display.drawStr(0, 28, "IP:");
    display.drawStr(0, 44, WiFi.localIP().toString().c_str());
  } else {
    display.drawStr(0, 12, "WiFi NO conectado");
    display.drawStr(0, 28, "Sistema mide igual");
  }

  display.sendBuffer();
  delay(1500);

  // =====================================================
  // ACELEROMETRO DERECHO OBLIGATORIO
  // =====================================================

  if (!inicializarAcelerometroDerecho()) {
    Serial.println("ERROR: No se detecto ADXL345 derecho.");
    Serial.println("El sistema NO arranca porque la mano derecha es obligatoria.");

    display.clearBuffer();
    display.setFont(u8g2_font_6x10_tf);
    display.drawStr(0, 12, "ERROR ADXL derecho");
    display.drawStr(0, 28, "No detectado");
    display.drawStr(0, 44, "Sistema detenido");
    display.drawStr(0, 60, "Revisar 0x53");
    display.sendBuffer();

    while (1) {
      noTone(BUZZER_PIN);
      digitalWrite(BUZZER_PIN, LOW);
      delay(100);
    }
  }

  Serial.println("ADXL345 derecho OK.");

  // =====================================================
  // ACELEROMETRO IZQUIERDO OPCIONAL
  // =====================================================

  acelerometroIzquierdoConectado = inicializarAcelerometroIzquierdo();

  limpiarBuffers();

  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);
  display.drawStr(0, 12, "Pulsera Parkinson");
  display.drawStr(0, 28, "Derecha OK");

  if (acelerometroIzquierdoConectado) {
    display.drawStr(0, 44, "Izquierda OK");
  } else {
    display.drawStr(0, 44, "Izquierda OFF");
  }

  if (WiFi.status() == WL_CONNECTED) {
    display.drawStr(0, 60, "WiFi OK");
  } else {
    display.drawStr(0, 60, "Sin WiFi");
  }

  display.sendBuffer();
  delay(1500);
}

// =======================================================
// LOOP
// =======================================================

void loop() {
  unsigned long tiempoActual = millis();

  // Mantiene activa la conexion WebSocket y gestiona reconexion/ping-pong.
  webSocket.loop();

  leerBoton();

  if (tiempoActual - tiempoVerificacionIzquierdaAnterior >= INTERVALO_VERIFICAR_IZQUIERDA_MS) {
    tiempoVerificacionIzquierdaAnterior = tiempoActual;
    verificarAcelerometroIzquierdo();
  }

  if (tiempoActual - tiempoMuestreoAnterior >= TS_MS) {
    tiempoMuestreoAnterior = tiempoActual;

    leerAcelerometros();
    guardarMuestras();
    controlarBuzzer();

    if (tiempoActual - tiempoEnvioWearableAnterior >= INTERVALO_ENVIO_WEARABLE_MS) {
      tiempoEnvioWearableAnterior = tiempoActual;

      // Datos crudos para el grafico en tiempo real por WebSocket.
      enviarDatosWearable();
    }
  }

  if (tiempoActual - tiempoAnalisisAnterior >= INTERVALO_ANALISIS_MS) {
    tiempoAnalisisAnterior = tiempoActual;

    if (bufferCompleto) {
      analizarFrecuencias();

      // Frecuencias/amplitudes para el grafico en tiempo real por WebSocket.
      enviarAnalisisTemblor();

      if (!alarmaBloqueada) {
        verificarFrecuenciaEnRango();
        verificarDeteccionSostenida();
      }

      mostrarMonitorSerial();
      mostrarDisplay();
    } else {
      mostrarPantallaCargando();
    }
  }
}

// =======================================================
// WIFI
// =======================================================

void conectarWiFi() {
  Serial.println();
  Serial.println("=== CONEXION WIFI ===");

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(1000);

  Serial.print("Conectando a: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long inicio = millis();
  const unsigned long TIEMPO_MAXIMO_WIFI_MS = 15000;

  while (WiFi.status() != WL_CONNECTED && millis() - inicio < TIEMPO_MAXIMO_WIFI_MS) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wifiDisponible = true;
    Serial.println("WiFi conectado correctamente.");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    wifiDisponible = false;
    Serial.println("No se pudo conectar a WiFi.");
    Serial.println("El sistema seguira midiendo sin enviar datos.");
  }
}

// =======================================================
// INICIALIZACION DE ACELEROMETROS
// =======================================================

bool inicializarAcelerometroDerecho() {
  Serial.println("Buscando ADXL345 derecho en bus principal, direccion 0x53...");

  // La libreria Adafruit usa Wire, que ya esta inicializado en 21/22.
  if (!adxlDerecha.begin(DIRECCION_ADXL_DERECHA)) {
    Serial.println("No se detecto ADXL345 derecho con libreria Adafruit.");
    return false;
  }

  adxlDerecha.setRange(ADXL345_RANGE_4_G);
  acelerometroDerechoOK = true;

  return true;
}

bool inicializarAcelerometroIzquierdo() {
  Serial.println("Buscando ADXL345 izquierdo en bus secundario, direccion 0x53...");

  if (!adxl345PresenteEnBus(WireIzquierda, DIRECCION_ADXL_IZQUIERDA)) {
    Serial.println("ADXL345 izquierdo no detectado en bus secundario.");
    limpiarDatosIzquierda();
    limpiarFrecuenciasIzquierda();
    return false;
  }

  bool okFormato = escribirRegistroADXL(
    WireIzquierda,
    DIRECCION_ADXL_IZQUIERDA,
    REG_DATA_FORMAT_ADXL345,
    ADXL345_DATA_FORMAT_4G_FULLRES
  );

  bool okMedicion = escribirRegistroADXL(
    WireIzquierda,
    DIRECCION_ADXL_IZQUIERDA,
    REG_POWER_CTL_ADXL345,
    ADXL345_MEASURE_MODE
  );

  if (!okFormato || !okMedicion) {
    Serial.println("ADXL345 izquierdo detectado, pero no se pudo configurar.");
    limpiarDatosIzquierda();
    limpiarFrecuenciasIzquierda();
    return false;
  }

  promedioXIzquierda = 0;
  promedioYIzquierda = 0;
  promedioZIzquierda = 9.81;

  Serial.println("ADXL345 izquierdo OK en bus secundario.");

  return true;
}

void verificarAcelerometroIzquierdo() {
  bool presente = adxl345PresenteEnBus(WireIzquierda, DIRECCION_ADXL_IZQUIERDA);

  if (presente && !acelerometroIzquierdoConectado) {
    Serial.println("Se conecto/reconecto el acelerometro izquierdo.");
    acelerometroIzquierdoConectado = inicializarAcelerometroIzquierdo();
  }

  if (!presente && acelerometroIzquierdoConectado) {
    Serial.println("Se desconecto el acelerometro izquierdo.");
    acelerometroIzquierdoConectado = false;
    limpiarDatosIzquierda();
    limpiarFrecuenciasIzquierda();
  }
}

// =======================================================
// FUNCIONES I2C MANUALES PARA ADXL IZQUIERDO
// =======================================================

bool i2cPresente(TwoWire &bus, byte direccion) {
  bus.beginTransmission(direccion);
  byte error = bus.endTransmission();
  return error == 0;
}

bool escribirRegistroADXL(TwoWire &bus, byte direccion, byte registro, byte valor) {
  bus.beginTransmission(direccion);
  bus.write(registro);
  bus.write(valor);
  byte error = bus.endTransmission();

  return error == 0;
}

bool leerRegistroADXL(TwoWire &bus, byte direccion, byte registro, byte &valor) {
  bus.beginTransmission(direccion);
  bus.write(registro);

  byte error = bus.endTransmission(false);

  if (error != 0) {
    return false;
  }

  bus.requestFrom((uint8_t)direccion, (uint8_t)1);

  if (bus.available() < 1) {
    return false;
  }

  valor = bus.read();
  return true;
}

bool adxl345PresenteEnBus(TwoWire &bus, byte direccion) {
  if (!i2cPresente(bus, direccion)) {
    return false;
  }

  byte devid = 0;

  if (!leerRegistroADXL(bus, direccion, REG_DEVID_ADXL345, devid)) {
    return false;
  }

  Serial.print("ADXL en bus, direccion 0x");
  Serial.print(direccion, HEX);
  Serial.print(" DEVID: 0x");
  Serial.println(devid, HEX);

  return devid == VALOR_DEVID_ADXL345;
}

bool leerAceleracionADXLManual(TwoWire &bus, byte direccion, float &ax, float &ay, float &az) {
  bus.beginTransmission(direccion);
  bus.write(REG_DATAX0_ADXL345);

  byte error = bus.endTransmission(false);

  if (error != 0) {
    return false;
  }

  bus.requestFrom((uint8_t)direccion, (uint8_t)6);

  if (bus.available() < 6) {
    return false;
  }

  uint8_t x0 = bus.read();
  uint8_t x1 = bus.read();
  uint8_t y0 = bus.read();
  uint8_t y1 = bus.read();
  uint8_t z0 = bus.read();
  uint8_t z1 = bus.read();

  int16_t rawX = (int16_t)((x1 << 8) | x0);
  int16_t rawY = (int16_t)((y1 << 8) | y0);
  int16_t rawZ = (int16_t)((z1 << 8) | z0);

  ax = rawX * ADXL345_M_S2_POR_LSB;
  ay = rawY * ADXL345_M_S2_POR_LSB;
  az = rawZ * ADXL345_M_S2_POR_LSB;

  return true;
}

// =======================================================
// LECTURA DE ACELEROMETROS
// =======================================================

void leerAcelerometros() {
  leerAcelerometroDerecho();

  if (acelerometroIzquierdoConectado) {
    leerAcelerometroIzquierdo();
  } else {
    limpiarDatosIzquierda();
  }
}

void leerAcelerometroDerecho() {
  sensors_event_t event;
  adxlDerecha.getEvent(&event);

  axDerecha = event.acceleration.x;
  ayDerecha = event.acceleration.y;
  azDerecha = event.acceleration.z;

  promedioXDerecha = 0.98 * promedioXDerecha + 0.02 * axDerecha;
  promedioYDerecha = 0.98 * promedioYDerecha + 0.02 * ayDerecha;
  promedioZDerecha = 0.98 * promedioZDerecha + 0.02 * azDerecha;

  axDinamicaDerecha = axDerecha - promedioXDerecha;
  ayDinamicaDerecha = ayDerecha - promedioYDerecha;
  azDinamicaDerecha = azDerecha - promedioZDerecha;
}

void leerAcelerometroIzquierdo() {
  bool lecturaOK = leerAceleracionADXLManual(
    WireIzquierda,
    DIRECCION_ADXL_IZQUIERDA,
    axIzquierda,
    ayIzquierda,
    azIzquierda
  );

  if (!lecturaOK) {
    Serial.println("Error leyendo ADXL izquierdo. Se marca como desconectado.");
    acelerometroIzquierdoConectado = false;
    limpiarDatosIzquierda();
    limpiarFrecuenciasIzquierda();
    return;
  }

  promedioXIzquierda = 0.98 * promedioXIzquierda + 0.02 * axIzquierda;
  promedioYIzquierda = 0.98 * promedioYIzquierda + 0.02 * ayIzquierda;
  promedioZIzquierda = 0.98 * promedioZIzquierda + 0.02 * azIzquierda;

  axDinamicaIzquierda = axIzquierda - promedioXIzquierda;
  ayDinamicaIzquierda = ayIzquierda - promedioYIzquierda;
  azDinamicaIzquierda = azIzquierda - promedioZIzquierda;
}

void limpiarDatosIzquierda() {
  axIzquierda = 0;
  ayIzquierda = 0;
  azIzquierda = 0;

  axDinamicaIzquierda = 0;
  ayDinamicaIzquierda = 0;
  azDinamicaIzquierda = 0;

  promedioXIzquierda = 0;
  promedioYIzquierda = 0;
  promedioZIzquierda = 9.81;
}

void limpiarFrecuenciasIzquierda() {
  freqXIzquierda = 0;
  freqYIzquierda = 0;
  freqZIzquierda = 0;
  freqXYZIzquierda = 0;

  ampXIzquierda = 0;
  ampYIzquierda = 0;
  ampZIzquierda = 0;
  ampXYZIzquierda = 0;
}

// =======================================================
// GUARDADO DE MUESTRAS
// =======================================================

void guardarMuestras() {
  muestrasXDerecha[indiceBuffer] = axDinamicaDerecha;
  muestrasYDerecha[indiceBuffer] = ayDinamicaDerecha;
  muestrasZDerecha[indiceBuffer] = azDinamicaDerecha;

  if (acelerometroIzquierdoConectado) {
    muestrasXIzquierda[indiceBuffer] = axDinamicaIzquierda;
    muestrasYIzquierda[indiceBuffer] = ayDinamicaIzquierda;
    muestrasZIzquierda[indiceBuffer] = azDinamicaIzquierda;
  } else {
    muestrasXIzquierda[indiceBuffer] = 0;
    muestrasYIzquierda[indiceBuffer] = 0;
    muestrasZIzquierda[indiceBuffer] = 0;
  }

  indiceBuffer++;

  if (indiceBuffer >= N) {
    indiceBuffer = 0;
    bufferCompleto = true;
  }
}

void limpiarBuffers() {
  for (int i = 0; i < N; i++) {
    muestrasXDerecha[i] = 0;
    muestrasYDerecha[i] = 0;
    muestrasZDerecha[i] = 0;

    muestrasXIzquierda[i] = 0;
    muestrasYIzquierda[i] = 0;
    muestrasZIzquierda[i] = 0;
  }
}

// =======================================================
// ANALISIS DE FRECUENCIAS
// =======================================================

void analizarFrecuencias() {
  analizarCanal(muestrasXDerecha, freqXDerecha, ampXDerecha);
  analizarCanal(muestrasYDerecha, freqYDerecha, ampYDerecha);
  analizarCanal(muestrasZDerecha, freqZDerecha, ampZDerecha);

  analizarCanalCombinadoXYZ(
    muestrasXDerecha,
    muestrasYDerecha,
    muestrasZDerecha,
    freqXYZDerecha,
    ampXYZDerecha
  );

  if (acelerometroIzquierdoConectado) {
    analizarCanal(muestrasXIzquierda, freqXIzquierda, ampXIzquierda);
    analizarCanal(muestrasYIzquierda, freqYIzquierda, ampYIzquierda);
    analizarCanal(muestrasZIzquierda, freqZIzquierda, ampZIzquierda);

    analizarCanalCombinadoXYZ(
      muestrasXIzquierda,
      muestrasYIzquierda,
      muestrasZIzquierda,
      freqXYZIzquierda,
      ampXYZIzquierda
    );
  } else {
    limpiarFrecuenciasIzquierda();
  }
}

void analizarCanal(float buffer[], float &frecuencia, float &amplitudDominante) {
  frecuencia = 0;
  amplitudDominante = 0;

  for (float f = FREQ_BUSQUEDA_MIN; f <= FREQ_BUSQUEDA_MAX; f += PASO_FREQ) {
    float real = 0;
    float imag = 0;

    for (int i = 0; i < N; i++) {
      int indiceReal = (indiceBuffer + i) % N;

      float muestra = buffer[indiceReal];
      float angulo = 2.0 * PI * f * i / FS;

      real += muestra * cos(angulo);
      imag -= muestra * sin(angulo);
    }

    float amplitud = (2.0 / N) * sqrt(real * real + imag * imag);

    if (amplitud > amplitudDominante) {
      amplitudDominante = amplitud;
      frecuencia = f;
    }
  }
}

void analizarCanalCombinadoXYZ(
  float bufferX[],
  float bufferY[],
  float bufferZ[],
  float &frecuenciaXYZ,
  float &amplitudXYZ
) {
  frecuenciaXYZ = 0;
  amplitudXYZ = 0;

  for (float f = FREQ_BUSQUEDA_MIN; f <= FREQ_BUSQUEDA_MAX; f += PASO_FREQ) {
    float realX = 0;
    float imagX = 0;

    float realY = 0;
    float imagY = 0;

    float realZ = 0;
    float imagZ = 0;

    for (int i = 0; i < N; i++) {
      int indiceReal = (indiceBuffer + i) % N;

      float angulo = 2.0 * PI * f * i / FS;
      float coseno = cos(angulo);
      float seno = sin(angulo);

      float muestraX = bufferX[indiceReal];
      float muestraY = bufferY[indiceReal];
      float muestraZ = bufferZ[indiceReal];

      realX += muestraX * coseno;
      imagX -= muestraX * seno;

      realY += muestraY * coseno;
      imagY -= muestraY * seno;

      realZ += muestraZ * coseno;
      imagZ -= muestraZ * seno;
    }

    float ampActualX = (2.0 / N) * sqrt(realX * realX + imagX * imagX);
    float ampActualY = (2.0 / N) * sqrt(realY * realY + imagY * imagY);
    float ampActualZ = (2.0 / N) * sqrt(realZ * realZ + imagZ * imagZ);

    float ampTotalActual = sqrt(
      ampActualX * ampActualX +
      ampActualY * ampActualY +
      ampActualZ * ampActualZ
    );

    if (ampTotalActual > amplitudXYZ) {
      amplitudXYZ = ampTotalActual;
      frecuenciaXYZ = f;
    }
  }
}

// =======================================================
// DETECCION DE TEMBLOR EN AMBAS MANOS
// =======================================================

void verificarFrecuenciaEnRango() {
  frecuenciaEnRango = false;
  frecuenciaDetectada = 0;
  amplitudDetectada = 0;
  canalDominante = "-";
  manoDominante = "-";

  float mayorAmplitudValida = 0;

  evaluarCanal("Derecha", "X", freqXDerecha, ampXDerecha, mayorAmplitudValida);
  evaluarCanal("Derecha", "Y", freqYDerecha, ampYDerecha, mayorAmplitudValida);
  evaluarCanal("Derecha", "Z", freqZDerecha, ampZDerecha, mayorAmplitudValida);
  evaluarCanal("Derecha", "XYZ", freqXYZDerecha, ampXYZDerecha, mayorAmplitudValida);

  if (acelerometroIzquierdoConectado) {
    evaluarCanal("Izquierda", "X", freqXIzquierda, ampXIzquierda, mayorAmplitudValida);
    evaluarCanal("Izquierda", "Y", freqYIzquierda, ampYIzquierda, mayorAmplitudValida);
    evaluarCanal("Izquierda", "Z", freqZIzquierda, ampZIzquierda, mayorAmplitudValida);
    evaluarCanal("Izquierda", "XYZ", freqXYZIzquierda, ampXYZIzquierda, mayorAmplitudValida);
  }
}

void evaluarCanal(String mano, String canal, float frecuencia, float amplitud, float &mayorAmplitudValida) {
  bool canalValido =
    frecuencia >= FREQ_MIN_TEMBLOR &&
    frecuencia <= FREQ_MAX_TEMBLOR &&
    amplitud >= UMBRAL_AMPLITUD;

  if (canalValido && amplitud > mayorAmplitudValida) {
    mayorAmplitudValida = amplitud;
    frecuenciaDetectada = frecuencia;
    amplitudDetectada = amplitud;
    canalDominante = canal;
    manoDominante = mano;
    frecuenciaEnRango = true;
  }
}

void verificarDeteccionSostenida() {
  unsigned long tiempoActual = millis();

  if (frecuenciaEnRango) {
    tiempoUltimaDeteccionValida = tiempoActual;

    if (!deteccionEnCurso) {
      deteccionEnCurso = true;
      tiempoInicioDeteccion = tiempoActual;
      tiempoDeteccionSostenida = 0;
    }

    tiempoDeteccionSostenida = tiempoActual - tiempoInicioDeteccion;

    if (tiempoDeteccionSostenida >= TIEMPO_MINIMO_DETECCION_MS) {
      episodioDetectado = true;

      if (!buzzerActivo && !alarmaBloqueada) {
        buzzerActivo = true;
        mostrarMensajeMovimiento = false;
        alarmaBloqueada = true;

        tiempoInicioBuzzer = tiempoActual;

        // UNICO buzzer fisico del sistema.
        tone(BUZZER_PIN, 1000);

        if (!eventoValidadoEnviado) {
          // =================================================
          // ENVIO DEL EVENTO VALIDADO A LA APP
          // =================================================
        
          //
          enviarEventoValidado();
          // =================================================

          Serial.println("EVENTO VALIDADO. Envio a app desactivado temporalmente.");
          eventoValidadoEnviado = true;
        }
      }
    }
  } else {
    if (deteccionEnCurso) {
      unsigned long tiempoSinDeteccion = tiempoActual - tiempoUltimaDeteccionValida;

      if (tiempoSinDeteccion <= TIEMPO_PERDIDA_PERMITIDA_MS) {
        tiempoDeteccionSostenida = tiempoActual - tiempoInicioDeteccion;
      } else {
        deteccionEnCurso = false;
        tiempoInicioDeteccion = 0;
        tiempoDeteccionSostenida = 0;
        tiempoUltimaDeteccionValida = 0;
        episodioDetectado = false;
      }
    } else {
      tiempoDeteccionSostenida = 0;
      episodioDetectado = false;
    }
  }
}

// =======================================================
// BUZZER
// =======================================================

void controlarBuzzer() {
  if (buzzerActivo) {
    unsigned long tiempoActual = millis();

    if (tiempoActual - tiempoInicioBuzzer >= DURACION_BUZZER_MS) {
      noTone(BUZZER_PIN);
      digitalWrite(BUZZER_PIN, LOW);

      buzzerActivo = false;
      mostrarMensajeMovimiento = true;
    }
  }
}

// =======================================================
// BOTON
// =======================================================

void leerBoton() {
  bool estadoActual = digitalRead(BOTON_PIN);

  if (estadoActual != estadoBotonAnterior) {
    ultimoCambioBoton = millis();
    estadoBotonAnterior = estadoActual;
  }

  if ((millis() - ultimoCambioBoton) > TIEMPO_ANTIRREBOTE_MS) {
    if (estadoActual != estadoBotonConfirmado) {
      estadoBotonConfirmado = estadoActual;

      if (estadoBotonConfirmado == LOW && mostrarMensajeMovimiento) {
        resetearSistemaPostEjercicio();
      }
    }
  }
}

void resetearSistemaPostEjercicio() {
  Serial.println("Boton presionado. Se vuelve al modo medicion.");

  // =====================================================
  // ENVIO DEL EJERCICIO COMPLETADO A LA APP
  // =====================================================
 
  //
  enviarEjercicioCompletado();
  // =====================================================

  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);

  buzzerActivo = false;
  mostrarMensajeMovimiento = false;
  alarmaBloqueada = false;
  eventoValidadoEnviado = false;

  deteccionEnCurso = false;
  tiempoInicioDeteccion = 0;
  tiempoDeteccionSostenida = 0;
  tiempoUltimaDeteccionValida = 0;

  frecuenciaEnRango = false;
  episodioDetectado = false;

  frecuenciaDetectada = 0;
  amplitudDetectada = 0;
  canalDominante = "-";
  manoDominante = "-";

  indiceBuffer = 0;
  bufferCompleto = false;
  limpiarBuffers();

  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);
  display.drawStr(0, 12, "Volviendo a medir");
  display.drawStr(0, 30, "Recolectando");
  display.drawStr(0, 46, "nuevas muestras");
  display.sendBuffer();

  delay(500);
}

// =======================================================
// WEBSOCKET PARA GRAFICO EN TIEMPO REAL
// =======================================================

void iniciarWebSocket() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WebSocket no iniciado porque no hay WiFi.");
    return;
  }

  Serial.println("Iniciando WebSocket para grafico en tiempo real...");
  Serial.print("Host: ");
  Serial.println(WS_HOST);
  Serial.print("Path: ");
  Serial.println(WS_PATH);

  // Conexion segura por 443 contra Render.
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  // Heartbeat para mantener viva la conexion.
  // ping cada 15 s, espera pong 3 s, tolera 2 fallos.
  webSocket.enableHeartbeat(15000, 3000, 2);
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      webSocketConectado = false;
      Serial.println("WebSocket desconectado.");
      break;

    case WStype_CONNECTED:
      webSocketConectado = true;
      Serial.println("WebSocket conectado al servidor.");
      break;

    case WStype_TEXT:
      Serial.print("Mensaje WebSocket recibido: ");
      Serial.println((char*)payload);
      break;

    case WStype_ERROR:
      webSocketConectado = false;
      Serial.println("Error en WebSocket.");
      break;

    default:
      break;
  }
}

void enviarWebSocketGrafico(String json) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  if (!webSocketConectado) {
    return;
  }

  webSocket.sendTXT(json);
}

// =======================================================
// HTTP POST NO BLOQUEANTE PARA EVENTOS IMPORTANTES
// =======================================================

void dejarJsonPendiente(String json, bool prioritario) {
  if (mutexEnvioApp == NULL) return;

  if (xSemaphoreTake(mutexEnvioApp, 10 / portTICK_PERIOD_MS) == pdTRUE) {
    if (prioritario) {
      jsonPendientePrioritario = json;
      hayJsonPendientePrioritario = true;
    } else {
      // Para datos continuos, guardamos solo el ultimo.
      // Asi no se acumula una cola gigante si internet responde lento.
      jsonPendienteNormal = json;
      hayJsonPendienteNormal = true;
    }

    xSemaphoreGive(mutexEnvioApp);
  }
}

void tareaEnvioApp(void *parameter) {
  for (;;) {
    if (ENVIO_APP_ACTIVO && WiFi.status() == WL_CONNECTED) {
      String jsonAEnviar = "";

      if (mutexEnvioApp != NULL) {
        if (xSemaphoreTake(mutexEnvioApp, 50 / portTICK_PERIOD_MS) == pdTRUE) {
          if (hayJsonPendientePrioritario) {
            jsonAEnviar = jsonPendientePrioritario;
            hayJsonPendientePrioritario = false;
          } else if (hayJsonPendienteNormal) {
            jsonAEnviar = jsonPendienteNormal;
            hayJsonPendienteNormal = false;
          }

          xSemaphoreGive(mutexEnvioApp);
        }
      }

      if (jsonAEnviar.length() > 0) {
        enviarJsonAApp(jsonAEnviar);
      }
    }

    vTaskDelay(50 / portTICK_PERIOD_MS);
  }
}

bool enviarJsonAApp(String json) {
  if (!ENVIO_APP_ACTIVO) {
    return false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    wifiDisponible = false;
    Serial.println("No se envio JSON porque no hay WiFi.");
    return false;
  }

  wifiDisponible = true;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  // Importante: limita cuanto puede esperar el POST.
  // Si el endpoint tarda o falla, se bloquea solo la tarea de envio,
  // no el loop principal ni el display.
  http.setTimeout(800);

  if (!http.begin(client, APP_ENDPOINT)) {
    Serial.println("No se pudo iniciar conexion HTTP.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");

  int codigoRespuesta = http.POST(json);

  Serial.print("Envio a app HTTP: " );
  Serial.println(codigoRespuesta);

  http.end();

  return codigoRespuesta >= 200 && codigoRespuesta < 300;
}

void enviarDatosWearable() {
  float magnitudDerecha = calcularMagnitudDinamicaDerecha();
  float magnitudIzquierda = calcularMagnitudDinamicaIzquierda();

  String json = "{";
  json += "\"type\":\"rt_accel\",";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"timestamp\":\"" + crearTimestamp() + "\",";
  json += "\"data\":{";
  json += "\"time\":" + String(millis()) + ",";

  json += "\"manoDerecha\":{";
  json += "\"connected\":true,";
  json += "\"raw\":{";
  json += "\"x\":" + String(axDerecha, 4) + ",";
  json += "\"y\":" + String(ayDerecha, 4) + ",";
  json += "\"z\":" + String(azDerecha, 4);
  json += "},";
  json += "\"dynamic\":{";
  json += "\"x\":" + String(axDinamicaDerecha, 4) + ",";
  json += "\"y\":" + String(ayDinamicaDerecha, 4) + ",";
  json += "\"z\":" + String(azDinamicaDerecha, 4);
  json += "},";
  json += "\"magnitude\":" + String(magnitudDerecha, 4) + ",";
  json += "\"frequencyXYZ\":" + String(freqXYZDerecha, 2) + ",";
  json += "\"amplitudeXYZ\":" + String(ampXYZDerecha, 4);
  json += "},";

  json += "\"manoIzquierda\":{";
  json += "\"connected\":";
  json += acelerometroIzquierdoConectado ? "true" : "false";

  if (acelerometroIzquierdoConectado) {
    json += ",";
    json += "\"raw\":{";
    json += "\"x\":" + String(axIzquierda, 4) + ",";
    json += "\"y\":" + String(ayIzquierda, 4) + ",";
    json += "\"z\":" + String(azIzquierda, 4);
    json += "},";
    json += "\"dynamic\":{";
    json += "\"x\":" + String(axDinamicaIzquierda, 4) + ",";
    json += "\"y\":" + String(ayDinamicaIzquierda, 4) + ",";
    json += "\"z\":" + String(azDinamicaIzquierda, 4);
    json += "},";
    json += "\"magnitude\":" + String(magnitudIzquierda, 4) + ",";
    json += "\"frequencyXYZ\":" + String(freqXYZIzquierda, 2) + ",";
    json += "\"amplitudeXYZ\":" + String(ampXYZIzquierda, 4);
  }

  json += "}";

  json += "}";
  json += "}";

  enviarWebSocketGrafico(json);
}

void enviarAnalisisTemblor() {
  String json = "{";
  json += "\"type\":\"rt_frequency\",";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"timestamp\":\"" + crearTimestamp() + "\",";
  json += "\"data\":{";
  json += "\"time\":" + String(millis()) + ",";

  json += "\"manoIzquierdaConectada\":";
  json += acelerometroIzquierdoConectado ? "true" : "false";
  json += ",";

  json += "\"manoDerecha\":{";
  json += "\"freqX\":" + String(freqXDerecha, 2) + ",";
  json += "\"freqY\":" + String(freqYDerecha, 2) + ",";
  json += "\"freqZ\":" + String(freqZDerecha, 2) + ",";
  json += "\"freqXYZ\":" + String(freqXYZDerecha, 2) + ",";
  json += "\"ampX\":" + String(ampXDerecha, 4) + ",";
  json += "\"ampY\":" + String(ampYDerecha, 4) + ",";
  json += "\"ampZ\":" + String(ampZDerecha, 4) + ",";
  json += "\"ampXYZ\":" + String(ampXYZDerecha, 4);
  json += "},";

  json += "\"manoIzquierda\":{";
  json += "\"connected\":";
  json += acelerometroIzquierdoConectado ? "true" : "false";

  if (acelerometroIzquierdoConectado) {
    json += ",";
    json += "\"freqX\":" + String(freqXIzquierda, 2) + ",";
    json += "\"freqY\":" + String(freqYIzquierda, 2) + ",";
    json += "\"freqZ\":" + String(freqZIzquierda, 2) + ",";
    json += "\"freqXYZ\":" + String(freqXYZIzquierda, 2) + ",";
    json += "\"ampX\":" + String(ampXIzquierda, 4) + ",";
    json += "\"ampY\":" + String(ampYIzquierda, 4) + ",";
    json += "\"ampZ\":" + String(ampZIzquierda, 4) + ",";
    json += "\"ampXYZ\":" + String(ampXYZIzquierda, 4);
  }

  json += "},";

  json += "\"deteccionGlobal\":{";
  json += "\"frequency\":" + String(frecuenciaDetectada, 2) + ",";
  json += "\"amplitude\":" + String(amplitudDetectada, 4) + ",";
  json += "\"mano\":\"" + manoDominante + "\",";
  json += "\"canal\":\"" + canalDominante + "\",";
  json += "\"severity\":\"" + obtenerSeveridad(amplitudDetectada) + "\",";
  json += "\"classification\":\"" + obtenerClasificacion() + "\"";
  json += "}";

  json += "}";
  json += "}";

  enviarWebSocketGrafico(json);
}

void enviarEventoValidado() {
  String json = "{";
  json += "\"type\":\"parkinson_event\",";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"timestamp\":\"" + crearTimestamp() + "\",";
  json += "\"data\":{";
  json += "\"eventDetected\":true,";
  json += "\"status\":\"validated\",";
  json += "\"manoDetectada\":\"" + manoDominante + "\",";
  json += "\"canalDominante\":\"" + canalDominante + "\",";
  json += "\"peakFrequency\":" + String(frecuenciaDetectada, 2) + ",";
  json += "\"peakAmplitude\":" + String(amplitudDetectada, 4) + ",";
  json += "\"severity\":\"" + obtenerSeveridad(amplitudDetectada) + "\",";
  json += "\"classification\":\"Temblor de reposo\",";
  json += "\"manoIzquierdaConectada\":";
  json += acelerometroIzquierdoConectado ? "true" : "false";
  json += ",";
  json += "\"tiempoValidacionSegundos\":" + String(TIEMPO_MINIMO_DETECCION_MS / 1000.0, 1) + ",";
  json += "\"tiempoDeteccionSostenidaSegundos\":" + String(tiempoDeteccionSostenida / 1000.0, 1) + ",";
  json += "\"toleranciaPerdidaSegundos\":" + String(TIEMPO_PERDIDA_PERMITIDA_MS / 1000.0, 1) + ",";
  json += "\"recommendedExercise\":\"Cerrar el punio durante 10 segundos, repetir 10 veces\"";
  json += "}";
  json += "}";

  dejarJsonPendiente(json, true);
}

void enviarEjercicioCompletado() {
  String json = "{";
  json += "\"type\":\"session_log\",";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"timestamp\":\"" + crearTimestamp() + "\",";
  json += "\"data\":{";
  json += "\"id\":\"session_" + String(millis()) + "\",";
  json += "\"exerciseType\":\"Motricidad - Tapping\",";
  json += "\"duration\":100,";
  json += "\"manoIzquierdaConectada\":";
  json += acelerometroIzquierdoConectado ? "true" : "false";
  json += ",";
  json += "\"lastDetectedHand\":\"" + manoDominante + "\",";
  json += "\"metrics\":{";
  json += "\"score\":80,";
  json += "\"averageTremor\":" + String(frecuenciaDetectada, 2);
  json += "},";
  json += "\"notes\":\"Paciente presiono el boton luego del ejercicio indicado por la pulsera.\"";
  json += "}";
  json += "}";

  dejarJsonPendiente(json, true);
}

// =======================================================
// FUNCIONES AUXILIARES
// =======================================================

float calcularMagnitudDinamicaDerecha() {
  return sqrt(
    axDinamicaDerecha * axDinamicaDerecha +
    ayDinamicaDerecha * ayDinamicaDerecha +
    azDinamicaDerecha * azDinamicaDerecha
  );
}

float calcularMagnitudDinamicaIzquierda() {
  return sqrt(
    axDinamicaIzquierda * axDinamicaIzquierda +
    ayDinamicaIzquierda * ayDinamicaIzquierda +
    azDinamicaIzquierda * azDinamicaIzquierda
  );
}

String obtenerSeveridad(float amplitud) {
  if (amplitud < UMBRAL_AMPLITUD) return "Normal";
  if (amplitud < 0.30) return "Leve";
  if (amplitud < 0.60) return "Moderado";
  return "Severo";
}

String obtenerClasificacion() {
  if (!frecuenciaEnRango && !episodioDetectado) return "Ninguno";
  return "Temblor de reposo";
}

String crearTimestamp() {
  return "millis_" + String(millis());
}

// =======================================================
// MONITOR SERIAL
// =======================================================

void mostrarMonitorSerial() {
  Serial.print("DER ax: ");
  Serial.print(axDerecha, 2);
  Serial.print(" | ay: ");
  Serial.print(ayDerecha, 2);
  Serial.print(" | az: ");
  Serial.print(azDerecha, 2);

  Serial.print(" || Fder XYZ: ");
  Serial.print(freqXYZDerecha, 2);
  Serial.print(" Hz | Ader XYZ: ");
  Serial.print(ampXYZDerecha, 3);

  Serial.print(" || IZQ: ");

  if (acelerometroIzquierdoConectado) {
    Serial.print("OK ax: ");
    Serial.print(axIzquierda, 2);
    Serial.print(" | ay: ");
    Serial.print(ayIzquierda, 2);
    Serial.print(" | az: ");
    Serial.print(azIzquierda, 2);

    Serial.print(" || Fizq XYZ: ");
    Serial.print(freqXYZIzquierda, 2);
    Serial.print(" Hz | Aizq XYZ: ");
    Serial.print(ampXYZIzquierda, 3);
  } else {
    Serial.print("DESCONECTADA");
  }

  Serial.print(" || Detectada: ");
  Serial.print(manoDominante);
  Serial.print(" ");
  Serial.print(canalDominante);
  Serial.print(" ");
  Serial.print(frecuenciaDetectada, 2);
  Serial.print(" Hz | A: ");
  Serial.print(amplitudDetectada, 3);

  Serial.print(" | Tiempo sostenido: ");
  Serial.print(tiempoDeteccionSostenida / 1000.0, 1);
  Serial.print(" s | WiFi: ");
  Serial.print(WiFi.status() == WL_CONNECTED ? "OK" : "NO");

  Serial.print(" | Estado: ");

  if (episodioDetectado) {
    Serial.println("Episodio detectado");
  } else if (frecuenciaEnRango) {
    Serial.println("Frecuencia en rango");
  } else if (deteccionEnCurso) {
    Serial.println("Dentro de tolerancia");
  } else {
    Serial.println("Normal");
  }
}

// =======================================================
// DISPLAY
// =======================================================

void mostrarDisplay() {
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);

  char linea[40];

  if (buzzerActivo) {
    display.drawStr(0, 10, "ALERTA TEMBLOR");

    sprintf(linea, "Mano: %s", manoDominante.c_str());
    display.drawStr(0, 24, linea);

    sprintf(linea, "Canal: %s", canalDominante.c_str());
    display.drawStr(0, 38, linea);

    sprintf(linea, "Freq: %.1f Hz", frecuenciaDetectada);
    display.drawStr(0, 52, linea);

    display.drawStr(0, 64, "Buzzer activo");

    display.sendBuffer();
    return;
  }

  if (mostrarMensajeMovimiento) {
    display.drawStr(0, 10, "Episodio detectado");

    sprintf(linea, "Mano: %s", manoDominante.c_str());
    display.drawStr(0, 23, linea);

    display.drawStr(0, 36, "Cierra el punio 10s");
    display.drawStr(0, 49, "Repetir 10 veces");
    display.drawStr(0, 63, "Boton = listo");

    display.sendBuffer();
    return;
  }

  display.drawStr(0, 10, "Pulsera Parkinson");

  if (WiFi.status() == WL_CONNECTED) {
    display.drawStr(108, 10, "Wi");
  }

  if (acelerometroIzquierdoConectado) {
    sprintf(linea, "Fder: %.1fHz", freqXYZDerecha);
    display.drawStr(0, 24, linea);

    sprintf(linea, "Fizq: %.1fHz", freqXYZIzquierda);
    display.drawStr(0, 36, linea);

    sprintf(linea, "Ader: %.2f Aizq: %.2f", ampXYZDerecha, ampXYZIzquierda);
    display.drawStr(0, 49, linea);

    if (frecuenciaEnRango || deteccionEnCurso) {
      sprintf(linea, "%s %.1fs", manoDominante.c_str(), tiempoDeteccionSostenida / 1000.0);
      display.drawStr(0, 63, linea);
    } else {
      display.drawStr(0, 63, "2 manos activas");
    }
  } else {
    sprintf(linea, "Fder: %.1f Hz", freqXYZDerecha);
    display.drawStr(0, 24, linea);

    sprintf(linea, "Ader: %.2f", ampXYZDerecha);
    display.drawStr(0, 36, linea);

    display.drawStr(0, 49, "Izquierda: OFF");

    if (frecuenciaEnRango || deteccionEnCurso) {
      sprintf(linea, "Der %.1fs", tiempoDeteccionSostenida / 1000.0);
      display.drawStr(0, 63, linea);
    } else {
      display.drawStr(0, 63, "Estado: normal");
    }
  }

  display.sendBuffer();
}

void mostrarPantallaCargando() {
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);

  display.drawStr(0, 12, "Analizando senal");
  display.drawStr(0, 28, "Recolectando");
  display.drawStr(0, 42, "muestras...");

  if (acelerometroIzquierdoConectado) {
    display.drawStr(0, 58, "D + I conectadas");
  } else {F
    display.drawStr(0, 58, "Solo derecha");
  }

  display.sendBuffer();
  
}