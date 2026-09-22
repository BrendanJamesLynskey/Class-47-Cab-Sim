# The horn light (Raspberry Pi Pico)

A Raspberry Pi Pico plugged into the Pi with its own USB cable. Its little green light,
next to the USB socket, comes on whenever you sound the horn in the game.

| File | What is in it |
|------|---------------|
| [`main.py`](main.py) | The program on the Pico. It waits for a letter from the game: `H` turns the light on, `h` turns it off |
| [`test.html`](test.html) | A test page with "Light on" and "Light off" buttons, to check the Pico without the game |

You only need to do this if the Pico is new, or has been wiped. It is already done on ours.

## Put MicroPython on the Pico

MicroPython lets the Pico run Python programs. It goes on once.

1. Download the MicroPython file for the Pico from
   [micropython.org/download/RPI_PICO](https://micropython.org/download/RPI_PICO/). Pick the
   newest `.uf2` under "Releases". (For a Pico W use
   [RPI_PICO_W](https://micropython.org/download/RPI_PICO_W/) instead: the W has a little
   silver box on it, the plain Pico does not.)
2. Hold down the white **BOOTSEL** button on the Pico, plug in its USB cable, then let go.
3. A drive called **RPI-RP2** appears, like a USB stick. Drag the `.uf2` file onto it.
4. The drive disappears by itself. That means it worked: the Pico is now a MicroPython board.

## Put the horn light program on it

Easiest with `mpremote` (install it once with `pip install --user mpremote`). From this folder:

```
mpremote cp main.py :main.py + reset
```

(Or open `main.py` in [Thonny](https://thonny.org/), then File, Save as, Raspberry Pi Pico,
and call it `main.py`.) A file called `main.py` runs by itself every time the Pico is switched on.

## Check it works

1. Start the game with `./run`, then on the **same** computer as the Pico open
   `http://localhost:5173/pico/test.html` in Chrome or Chromium.
2. Press **Connect** and choose **Board in FS mode** from the list (not the Debug Probe).
3. Press **Light on** and **Light off**. The green light should follow.

## If it doesn't work

- **No RPI-RP2 drive appears:** try another USB cable (some only carry power), and plug the
  Pico straight into the computer, not into a USB hub without its own power supply. Such a hub
  may not give the Pico enough power, and the computer quietly ignores it.
- **The device list is empty, or says the port is busy:** only one program can talk to the
  Pico at a time. Close any other browser tab, Thonny or `mpremote` that is using it.
- **On Ubuntu, "permission denied":** normal users can't use serial ports. Either add yourself
  to the `dialout` group (`sudo usermod -aG dialout $USER`, then log out and in), or allow
  Raspberry Pi devices for everyone:
  `echo 'SUBSYSTEM=="tty", ATTRS{idVendor}=="2e8a", MODE="0666"' | sudo tee /etc/udev/rules.d/60-raspberrypi-pico.rules`.
  Raspberry Pi OS already allows it.
