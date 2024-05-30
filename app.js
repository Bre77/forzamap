var dgram = require('dgram');
const Parser = require("binary-parser").Parser;
const express = require('express');
const SSEChannel = require('sse-pubsub');
const crypto = require('crypto');

var forza = new Parser().endianess("little")
    .int32('IsRaceOn') // = 1 when race is on. = 0 when in menus/race stopped …
    .uint32('TimestampMS') //Can overflow to 0 eventually
    .floatle('EngineMaxRpm')
    .floatle('EngineIdleRpm')
    .floatle('CurrentEngineRpm')
    .floatle('AccelerationX') //In the car's local space; X = right, Y = up, Z = forward
    .floatle('AccelerationY')
    .floatle('AccelerationZ')
    .floatle('VelocityX') //In the car's local space; X = right, Y = up, Z = forward
    .floatle('VelocityY')
    .floatle('VelocityZ')
    .floatle('AngularVelocityX') //In the car's local space; X = pitch, Y = yaw, Z = roll
    .floatle('AngularVelocityY')
    .floatle('AngularVelocityZ')
    .floatle('Yaw')
    .floatle('Pitch')
    .floatle('Roll')
    .floatle('NormalizedSuspensionTravelFrontLeft') // Suspension travel normalized: 0.0f = max stretch; 1.0 = max compression
    .floatle('NormalizedSuspensionTravelFrontRight')
    .floatle('NormalizedSuspensionTravelRearLeft')
    .floatle('NormalizedSuspensionTravelRearRight')
    .floatle('TireSlipRatioFrontLeft') // Tire normalized slip ratio, = 0 means 100% grip and |ratio| > 1.0 means loss of grip.
    .floatle('TireSlipRatioFrontRight')
    .floatle('TireSlipRatioRearLeft')
    .floatle('TireSlipRatioRearRight')
    .floatle('WheelRotationSpeedFrontLeft') // Wheel rotation speed radians/sec.
    .floatle('WheelRotationSpeedFrontRight')
    .floatle('WheelRotationSpeedRearLeft')
    .floatle('WheelRotationSpeedRearRight')
    .int32('WheelOnRumbleStripFrontLeft') // = 1 when wheel is on rumble strip, = 0 when off.
    .int32('WheelOnRumbleStripFrontRight')
    .int32('WheelOnRumbleStripRearLeft')
    .int32('WheelOnRumbleStripRearRight')
    .floatle('WheelInPuddleDepthFrontLeft') // = from 0 to 1, where 1 is the deepest puddle
    .floatle('WheelInPuddleDepthFrontRight')
    .floatle('WheelInPuddleDepthRearLeft')
    .floatle('WheelInPuddleDepthRearRight')
    .floatle('SurfaceRumbleFrontLeft') // Non-dimensional surface rumble values passed to controller force feedback
    .floatle('SurfaceRumbleFrontRight')
    .floatle('SurfaceRumbleRearLeft')
    .floatle('SurfaceRumbleRearRight')
    .floatle('TireSlipAngleFrontLeft') // Tire normalized slip angle, = 0 means 100% grip and |angle| > 1.0 means loss of grip.
    .floatle('TireSlipAngleFrontRight')
    .floatle('TireSlipAngleRearLeft')
    .floatle('TireSlipAngleRearRight')
    .floatle('TireCombinedSlipFrontLeft') // Tire normalized combined slip, = 0 means 100% grip and |slip| > 1.0 means loss of grip.
    .floatle('TireCombinedSlipFrontRight')
    .floatle('TireCombinedSlipRearLeft')
    .floatle('TireCombinedSlipRearRight')
    .floatle('SuspensionTravelMetersFrontLeft') // Actual suspension travel in meters
    .floatle('SuspensionTravelMetersFrontRight')
    .floatle('SuspensionTravelMetersRearLeft')
    .floatle('SuspensionTravelMetersRearRight')
    .int32('CarOrdinal') //Unique ID of the car make/model
    .int32('CarClass') //Between 0 (D -- worst cars) and 7 (X class -- best cars) inclusive
    .int32('CarPerformanceIndex') //Between 100 (slowest car) and 999 (fastest car) inclusive
    .int32('DrivetrainType') //Corresponds to EDrivetrainType; 0 = FWD, 1 = RWD, 2 = AWD
    .int32('NumCylinders') //Number of cylinders in the engine
    .int32('unknown1')
    .int32('unknown2')
    .int32('unknown3')
    .floatle('PositionX')
    .floatle('PositionY')
    .floatle('PositionZ')
    .floatle('Speed') // meters per second
    .floatle('Power') // watts
    .floatle('Torque') // newton meter
    .floatle('TireTempFrontLeft')
    .floatle('TireTempFrontRight')
    .floatle('TireTempRearLeft')
    .floatle('TireTempRearRight')
    .floatle('Boost')
    .floatle('Fuel')
    .floatle('DistanceTraveled')
    .floatle('BestLap')
    .floatle('LastLap')
    .floatle('CurrentLap')
    .floatle('CurrentRaceTime')
    .uint16('LapNumber')
    .uint8('RacePosition')
    .uint8('Accel')
    .uint8('Brake')
    .uint8('Clutch')
    .uint8('HandBrake')
    .uint8('Gear')
    .int8('Steer')
    .int8('NormalizedDrivingLine')
    .int8('NormalizedAIBrakeDifference')
    .int8('unknown4')

let updates = {}

// Hash IP for privacy
const salt = "forzaisafunvideogame"

function haship(ip) {
    d = crypto.createHash('md5').update(salt + ip).digest("base64");
    return d
}

// Setup webserver
const app = express();
const channel = new SSEChannel();
const channel2 = new SSEChannel();
app.get('/data', (req, res) => channel.subscribe(req, res));
app.get('/data2', (req, res) => channel2.subscribe(req, res));
app.get('/uid.js', (req, res) => {
    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    res.type('.js');
    res.send(`const uid = "${haship(ip)}";`);
})
app.use(express.static(__dirname + '/public', { index: 'index.htm' }))

// Handle Forza payloads
const server = dgram.createSocket('udp4');
server.on('message', (msg, rinfo) => {
    // Validate Length
    if (rinfo.size !== 324) {
        console.warn(`Invalid package size ${rinfo.size} from ${rinfo.address}`)
        return
    }

    // Parse Data
    try {
        data = forza.parse(msg)
        if (data.IsRaceOn) {
            updates[rinfo.address] = data
            //server.send(msg, 5000)
            //sender = dgram.createSocket('udp4');
            //sender.bind(null, rinfo.address)
            //sender.send(msg, 5606)
            /*if(rinfo.address == "192.168.1.3"){
                server.sendto(msg, 30500, "192.168.1.3")
                
            }*/
        }
    } catch (e) {
        console.warn(e)
    }

    if (rinfo.address.startsWith("192.168.1.")) {
        server.send(msg, ("127.0.0.1", 5000))
    }
});

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

//Start servers
server.bind(5555);
app.listen(5555);

// Record data in Splunk
const options = {
    headers: { "Authorization": "Splunk forzamaphectoken" },
    rejectUnauthorized: false
}

// Sent data on regular interval
setInterval(() => {
    let payload = {}
    let payload2 = {}
    let n = Date.now() / 1000
    if (updates) {
        for (let u in updates) {
            let hash = haship(u)
            payload[hash] = [
                Math.round(updates[u].PositionY),
                updates[u].PositionX,
                updates[u].PositionZ,
                Math.round(updates[u].Yaw * 100) / 100,
                Math.round(updates[u].Speed * 100) / 100
            ]
            payload2[hash] = updates[u]
        }
        channel.publish(payload);
        channel2.publish(payload2);
        updates = {}
    }
}, 50)