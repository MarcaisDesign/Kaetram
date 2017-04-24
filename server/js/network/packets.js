/**
 * -- Packets Information --
 * Handshake - Responsible for the initial batch of packets sent from and to the server
 * Intro - Sent with Packets.LoginType representing login information [Packets.Introduction, Packets.LoginType.Login, [userData]];
 * Welcome - Packet received after the server has processed the Packets.LoginType
 * Spawns - Client receives information about the position of NPCs
 *
 * -- Opcode Information --
 * Login - Sent alongside `Intro` to indicate the type of login
 * Register - Same as Login
 */

var Packets = {
    Handshake: 0,
    Intro: 1,
    Welcome: 2,
    Spawns: 3
};

Packets.Opcode = {
    Login: 0,
    Register: 1
};