Pod::Spec.new do |s|
  s.name           = 'mediapipe_llm'
  s.version        = '1.0.0'
  s.summary        = 'MediaPipe LLM inference module for Expo'
  s.license        = { type: 'MIT' }
  s.author         = { 'InnerSpace' => 'support@innerspace.app' }
  s.platforms      = { ios: '14.4' }
  s.source         = { path: '.' }
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  
  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksGenai'
  s.dependency 'MediaPipeTasksGenAIC'
end
