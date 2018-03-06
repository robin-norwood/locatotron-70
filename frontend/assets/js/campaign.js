class Campaign extends React.Component {
  constructor (props) {
    super(props);

    this.state = {
      mode: 'loading',
      message: '',
      campaign: {
        admin_email: '',
        admin_token: '',
        center: { 'lng': 0, 'lat': 0 },
        description: '',
        id: 0,
        name: '',
        zoom: 0
      }
    };

    map.configureMap({
      zoom: 6,
      center: {lat: 38.0, lng: -119.0},
      mode: 'admin'
    });

    this.checkExistingCampaign();

    this.handleChange = this.handleChange.bind(this);
    this.handleUpdate = this.handleUpdate.bind(this);
    this.setNotifyMode = this.setNotifyMode.bind(this);
    this.handleNotification = this.handleNotification.bind(this);
  }

  checkExistingCampaign () {
    let params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    let token = params.get('admin_token');

    if (id && token) {
      this.getCampaign(id, token);
    }
    else {
      this.state.mode = 'create';
    }
  }

  getCampaign (id, token) {
    let url = baseURL + '/campaign/' + id + '?admin_token=' + token;
    fetch(url,
          { method: 'GET',
            mode: 'cors'
          })
          .then(response => response.json() )
          .then(data => {
            if (! data.hasOwnProperty('campaign')) {
              this.setState({mode: 'error'});
            }
            else {
              map.setMapLocation(data.campaign.center, data.campaign.zoom);

              this.setState({
                mode: 'manage',
                campaign: data.campaign
              });
            }
          })
          .catch(error => console.error(error))
  }

  handleChange (evt) {
    let cmp = this.state.campaign;
    cmp[evt.target.id] = evt.target.value;

    this.setState({'campaign': cmp});
  }

  handleUpdate (evt) {
    evt.preventDefault();

    let campaign = this.state.campaign;

    if (! campaign.name) {
      alert("You must enter a campaign name");
      return;
    }

    if (! campaign.admin_email) {
      alert("You must enter an email address");
      return;
    }

    let center = map.getMapCenter();
    let zoom = map.getMapZoom();

    let reqBody = {
      name: campaign.name,
      description: campaign.description,
      admin_email: campaign.admin_email,
      center: center,
      zoom: zoom
    };

    let newCampaign = !Boolean(campaign.id);
    let url = baseURL + '/campaign';

    if (!newCampaign) {
      url += '/' + campaign.id + '?admin_token=' + campaign.admin_token;
    }

    fetch(url,
          { method: newCampaign ? 'PUT' : 'POST',
            body: JSON.stringify(reqBody),
            mode: 'cors',
            headers: new Headers({
              'Content-Type': 'application/json'
            })
          })
          .then(response => response.json() )
          .then(data => {
            this.setState({mode: 'manage', campaign: data.campaign});
          })
          .catch(error => console.error(error));
  }

  getAdminURL() {
    if (!this.state.campaign.id) {
      return '';
    }

    let adminURL = window.location.origin + window.location.pathname;
    let params = new URLSearchParams();
    params.append('id', this.state.campaign.id);
    params.append('admin_token', this.state.campaign.admin_token);

    return adminURL + '?' + params.toString();
  }

  getSubscribeURL() {
    if (!this.state.campaign.id) {
      return '';
    }

    let subscribeURL = window.location.origin;
    if (window.location.pathname.indexOf('index') >= 0) {
      subscribeURL += window.location.pathname.replace('index', 'subscribe');
    }
    else {
      subscribeURL += '/subscribe.html';
    }

    let params = new URLSearchParams();
    params.append('id', this.state.campaign.id);

    return subscribeURL + '?' + params.toString();
  }

  setNotifyMode (evt) {
    evt.preventDefault();
    this.setState({mode: 'notify'});
    map.enableDrawing();
  }

  handleNotification (evt) {
    evt.preventDefault();
    if (!map.circle) {
      alert("Select an area on the map first.");
      return;
    }

    let url = baseURL + '/notify';

    let reqBody = {
      campaign: this.state.campaign,
      lng: map.circle.center.lng,
      lat: map.circle.center.lat,
      distance: map.circle.radius
    };

    fetch(url,
          { method: 'PUT',
            body: JSON.stringify(reqBody),
            mode: 'cors',
            headers: new Headers({
              'Content-Type': 'application/json'
            })
          })
          .then(response => response.json() )
          .then(data => {
            let count = data.users.length;
            this.setState({message: `Sent ${count} Notifications!`});
          })
          .catch(error => console.error(error));
  }

  render () {
    let mode = this.state.mode;

    if (mode == 'loading') {
      return (
        <h2>Loading...</h2>
      )
    }

    let header = '';
    let adminURL = '';
    let subscribeURL = '';
    let buttons = '';

    if (mode == 'create') {
      header = "Create Campaign";
      buttons = (
        <button id="updateButton" onClick={this.handleUpdate} className="button">Create</button>
      )
    }
    else if (mode == 'manage') {
      header = "Manage Campaign";
      adminURL = this.getAdminURL();
      subscribeURL = this.getSubscribeURL();
      buttons = (
        <span>
          <button id="updateButton" onClick={this.handleUpdate} className="button">Update</button>
          <button id="notifyButton" onClick={this.setNotifyMode} className="button">Notify</button>
        </span>
      )
    }
    else if (mode == 'notify') {
      header = "Send Notifications";
      buttons = (
        <button id="sendNotificationButton" onClick={this.handleNotification} className="button">Send Notification</button>
      )
    }

    let campaign = this.state.campaign;

    return (
      <div id="appContainer">
        <h2>{header}</h2>
        <p>{this.state.message}</p>
        <form>
          <input type="text" id="admin_email" size="40" value={campaign.admin_email} onChange={this.handleChange} placeholder="Enter email address..." />
          <input type="text" id="name" size="40" value={campaign.name} onChange={this.handleChange} placeholder="Enter campaign name..." />
          <textarea id="description" cols="60" value={campaign.description} onChange={this.handleChange} placeholder="Enter campaign description...">{campaign.description}</textarea>
          {buttons}
        </form>
        {adminURL &&
          <div>
            <br/>
            <h3>Admin URL</h3>
            Bookmark this: <a href={adminURL}>{adminURL}</a>
          </div>
        }
        {subscribeURL &&
          <div>
            <br/>
            <h3>Subscription URL</h3>
            Send this to users: <a href={subscribeURL}>{subscribeURL}</a>
          </div>
        }
      </div>
    )
  }
}

ReactDOM.render(<Campaign />, document.getElementById('app'));
