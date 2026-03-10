swiftc -o test_capture Sources/AudioCapture/AudioCapture.swift test_capture.swift \ 
  -framework ScreenCaptureKit \
  -framework AVFoundation \
  -framework CoreAudio \
&& ./test_capture