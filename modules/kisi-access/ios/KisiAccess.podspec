Pod::Spec.new do |s|
  s.name           = 'KisiAccess'
  s.version        = '1.0.0'
  s.summary        = 'Tee Time Nexus Kisi SDK bridge'
  s.description    = 'Native adapter for booking-scoped Kisi device credentials.'
  s.author         = 'Tee Time Nexus'
  s.homepage       = 'https://teetimenexus.com'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: 'https://github.com/mrizwantech/teetimenexusmobile.git' }
  s.swift_version  = '6.0'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "*.swift"
  s.vendored_frameworks = 'vendor/SecureAccess.xcframework'
end
