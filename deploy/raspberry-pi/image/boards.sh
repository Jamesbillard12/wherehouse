#!/bin/sh

supported_boards="pi5 pi4"

board_config() {
  case "$1" in
    pi5) echo "wherehouse-pi5.yaml" ;;
    pi4) echo "wherehouse-pi4.yaml" ;;
    *) return 1 ;;
  esac
}

board_description() {
  case "$1" in
    pi5) echo "Raspberry Pi 5 (initial target)" ;;
    pi4) echo "Raspberry Pi 4 (configured; physical validation pending)" ;;
    *) return 1 ;;
  esac
}
