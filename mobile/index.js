import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent gère aussi bien Expo Go que les builds natifs, et
// appelle AppRegistry.registerComponent('main', ...) en interne.
registerRootComponent(App);
