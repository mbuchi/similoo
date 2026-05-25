// Location state manager
let instance = null;

class LocationStateManager {
    constructor() {
        if (instance) {
            return instance;
        }
        instance = this;

        this._location = {
            cartesian: null,
            longitude: null,
            latitude: null,
            height: null,
            displayName: null,
            searchText: null,
            status: null
        };
        this._listeners = new Set();
        this._history = [];
    }

    setLocation(location) {
        // Store previous location in history if it was a successful search
        if (this._location.status === 'found') {
            this._history.push({ ...this._location });
            // Keep only last 10 locations
            if (this._history.length > 10) {
                this._history.shift();
            }
        }

        this._location = {
            ...this._location,
            ...location
        };
        
        console.log('Location state updated:', {
            displayName: this._location.displayName,
            status: this._location.status,
            coordinates: this._location.longitude && this._location.latitude ? 
                `${this._location.latitude.toFixed(6)}, ${this._location.longitude.toFixed(6)}` : 
                'none'
        });
        
        this._notifyListeners();
    }

    getLocation() {
        return this._location;
    }
    
    getHistory() {
        return this._history;
    }
    
    getLastFoundLocation() {
        return this._history[this._history.length - 1] || null;
    }

    addListener(callback) {
        this._listeners.add(callback);
    }

    removeListener(callback) {
        this._listeners.delete(callback);
    }

    _notifyListeners() {
        this._listeners.forEach(callback => callback(this._location));
    }
}

export const locationState = new LocationStateManager();