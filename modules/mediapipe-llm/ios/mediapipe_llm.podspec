require 'json'

# mediapipe-llm Expo module iOS build configuration
Pod::Spec.new do |s|
  s.name           = 'mediapipe-llm'
  s.version        = '1.0.0'
  s.summary        = 'MediaPipe Gemma 2B LLM inference for InnerSpace'
  s.license        = { type: 'MIT' }
  s.author         = { 'InnerSpace' => 'support@innerspace.app' }
  s.platforms      = { ios: '14.4' }
  s.source         = { path: '.' }
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  
  s.dependency 'ExpoModulesCore'
  
  # MediaPipe Tasks GenAI pods (LLM inference support)
  s.dependency 'MediaPipeTasksGenAI', '~> 0.10'
  s.dependency 'MediaPipeTasksGenAIC', '~> 0.10'
end
