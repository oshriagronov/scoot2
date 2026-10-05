const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

/**
 * Apps built with the iOS 27 SDK must use the scene-based life cycle, or they
 * fail at launch. Expo SDK 57 ships `ExpoAppSceneDelegate` but its project
 * template doesn't use it yet; this applies what the SDK 58 template does.
 * Remove this plugin after upgrading to Expo SDK 58.
 */
module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            // Objective-C name of Expo's ExpoAppSceneDelegate.
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return c;
  });

  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle expects a Swift AppDelegate');
    }
    let src = c.modResults.contents;

    // The scene delegate reads the React Native factory from the app delegate.
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
    }

    // The scene delegate creates the window and starts React Native in it.
    src = src.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
      '    // The window is created and React Native is started by the scene delegate\n' +
        '    // (ExpoAppSceneDelegate) under the scene-based life cycle required by the iOS 27 SDK.\n',
    );

    if (!src.includes('ExpoReactNativeFactoryProvider') || src.includes('UIScreen.main.bounds')) {
      throw new Error('withSceneLifecycle could not update AppDelegate.swift; the Expo template has changed.');
    }
    c.modResults.contents = src;
    return c;
  });
};
