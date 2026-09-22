# main.py — runs by itself every time the Pico is switched on.
# The game sends it one letter down the USB cable whenever the horn changes,
# and it turns the little green light on the Pico on or off to match:
#   H = horn on (the driver is sounding the horn): light on
#   h = horn off: light off
from machine import Pin
import sys

led = Pin("LED", Pin.OUT)  # the Pico's own light, next to the USB socket
led.value(0)

while True:
    letter = sys.stdin.buffer.read(1)  # wait here until a letter arrives
    if letter == b"H":
        led.value(1)
    elif letter == b"h":
        led.value(0)
