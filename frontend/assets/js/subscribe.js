class Subscribe extends React.Component {
  constructor (props) {
    super(props);

    this.state = {
      mode: 'loading',
      loadingLocation: false,
      message: '',
      location: undefined,
      user: {
        id: 0,
        email: '',
        token: '',
        location: { 'lng': 0, 'lat': 0 },
        zoom: 0
      },
      campaign: {
        admin_email: '',
        center: { 'lng': 0, 'lat': 0 },
        description: '',
        id: 0,
        name: '',
        zoom: 0
      }
    }

    this.loadCampaignOrUser();

    this.getCurPosFailure = this.getCurPosFailure.bind(this);
    this.getCurPosSuccess = this.getCurPosSuccess.bind(this);

    this.locateDevice = this.locateDevice.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.submit = this.submit.bind(this);
  }

  loadCampaignOrUser () {
    let params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    let userid = params.get('user_id');
    let token = params.get('user_token');

    if (id) {
      this.getCampaign(id);
    }
    else if (userid && token) {
      this.getUser(userid, token);
    }
    else {
      this.state.mode = 'error';
      this.state.message = "Need a  or a user";
    }
  }

  getUser (userid, token) {
    let url = baseURL + '/user/' + userid + '?token=' + token;
    fetch(url,
      { method: 'GET',
        mode: 'cors'
     })
     .then(response => response.json())
     .then(data => {
       if (! data.hasOwnProperty('user')) {
         this.setState({mode: 'error'});
       }
       else {
         map.configureMap({
           zoom: data.user.zoom,
           center: data.user.location,
           mode: 'user'
         });

         map.placeMarker(data.user.location);

         this.setState({
           mode: 'manage',
           user: data.user
         });

         this.getCampaign(data.user.campaign_id);
       }
     })
     .catch(error => console.error(error))
  }

  getCampaign (id) {
    let url = baseURL + '/campaign/' + id;
    fetch(url,
      { method: 'GET',
        mode: 'cors'
      })
      .then(response => response.json())
      .then(data => {
        if (! data.hasOwnProperty('campaign')) {
          this.setState({mode: 'error', message: "Campaign not found."});
        }
        else {
          map.configureMap({
            zoom: data.campaign.zoom,
            center: data.campaign.center,
            mode: 'user'
          });

          this.setState({
            mode: 'subscribe',
            campaign: data.campaign
          });
        }
      })
      .catch(error => console.error(error))
  }

  getCurPosSuccess (pos) {

    this.setState({
      loadingLocation: false,
      message: `Your location: ${pos.coords.latitude}, ${pos.coord.longitude}`,
      location: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }
    });

    map.setMapLocation(this.state.location, 12);
    map.placeMarker(this.state.location);
  }

  getCurPosFailure () {
    this.setState({
      loadingLocation: false,
      message: "Could not load location data.",
      mode: 'error',
      location: undefined
    });
  }

  locateDevice (evt) {
    evt.preventDefault();

    navigator.geolocation.getCurrentPosition(this.getCurPosSuccess, this.getCurPosFailure);

    this.setState({
      loadingLocation: true
    });
  }

  getAdminURL() {
    if (!this.state.user.id) {
      return '';
    }

    let adminURL = window.location.origin + window.location.pathname;
    let params = new URLSearchParams();
    params.append('user_id', this.state.user.id);
    params.append('user_token', this.state.user.token);

    return adminURL + '?' + params.toString();
  }

  handleChange (evt) {
    let user = this.state.user;
    user[evt.target.id] = evt.target.value;

    this.setState({user: user});
  }

  submit (evt) {
    evt.preventDefault();

    let pos = map.getMarkerPosition();
    let zoom = map.getMapZoom();
    let eml = this.state.user.email;
    let campaign = this.state.campaign;
    let user = this.state.user;

    if (! pos) {
      alert("You must select a location on the map");
      return;
    }

    if (! eml) {
      alert("You must enter an email address");
      return;
    }

    let reqBody = {
      location: pos,
      zoom: zoom,
      email: eml,
      campaign_id: campaign.id
    }

    let url = baseURL + '/user';
    let method = 'PUT';

    if (user.token) {
      url += "/" + user.id.toString();
      method = 'POST';
      reqBody.token = user.token;
    }

    fetch(url,
          { method: method,
            body: JSON.stringify(reqBody),
            mode: 'cors',
            headers: new Headers({
              'Content-Type': 'application/json'
            })
          })
          .then(resp => resp.json())
          .then(data => {
            this.setState({
              user: data.user
            });
          })
          .catch(err => console.error(err))
  }

  render () {
    let user = this.state.user;
    let campaign = this.state.campaign;

    let geoButton = "";
    if (("geolocation" in navigator) && !(this.state.location || this.state.loadingLocation)) {
      geoButton = (<button className="button" id="locate" onClick={this.locateDevice}>Locate me</button>)
    }

    let message = '';
    if (this.state.loadingLocation) {
      message = "Loading...";
    }

    let location = this.state.location;
    if (location) {
    }

    let submitButton = '';
    if (campaign) {
      if (user.token) {
        submitButton = (<button className="button" id="submit" onClick={this.submit}>Update Subscription</button>);
      }
      else {
        submitButton = (<button className="button" id="submit" onClick={this.submit}>Subscribe</button>);
      }
    }

    let adminURL = '';
    if (this.state.user.id) {
      adminURL = this.getAdminURL();
    }

    if (this.state.message) {
      message = this.state.message;
    }

    return (
      <div id="appContainer">
        <h2>Subscribe to Campaign:</h2>
        <h4>{campaign.name || "Loading..."}</h4>
        <p>{campaign.description}</p>
        <form>
          <input type="text" id="email" size="40" value={user.email} onChange={this.handleChange} placeholder="Enter email address..." />

          <p>{message}</p>

          {geoButton}

          {submitButton}
        </form>
        {adminURL &&
          <div>
            <br/>
            <h3>Admin URL</h3>
            Bookmark this: <a href={adminURL}>{adminURL}</a>
          </div>
        }

      </div>
    )
  }
}

ReactDOM.render(<Subscribe />, document.getElementById('app'));
