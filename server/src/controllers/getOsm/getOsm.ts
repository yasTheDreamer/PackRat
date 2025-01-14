import osmtogeojson from 'osmtogeojson';
import axios from 'axios';
import {
  ErrorProcessingOverpassError,
  ErrorRetrievingOverpassError,
  InvalidRequestParamsError,
} from '../../helpers/errors';
import { responseHandler } from '../../helpers/responseHandler';

/**
 * Retrieves OpenStreetMap data based on the provided activity type, start point, and end point.
 * @param {Object} req - The request object containing the activity type, start point, and end point.
 * @param {Object} res - The response object used to send the retrieved OpenStreetMap data.
 * @return {Promise<void>} - A promise that resolves when the OpenStreetMap data is successfully retrieved and sent.
 */
export const getOsm = async (req, res, next) => {
  console.log('req', req); // log the request body to see what it looks like

  const overpassUrl = process.env.OSM_URI;

  const activityTypeTags = {
    hiking: '["highway"~"path|footway"]',
    skiing: '["piste:type"~"downhill|nordic"]',
    climbing: '["sport"="climbing"]',
    cycling: '["highway"~"cycleway(:left|:right)?"]',
    canoeing: '["waterway"~"riverbank|canal|stream"]',
    horseback_riding: '["highway"="bridleway"]',
    kayaking: '["waterway"~"riverbank|canal|stream|rapids|waterfall"]',
    rock_climbing: '["natural"="cliff"]',
    sailing: '["waterway"~"riverbank|canal|harbour|basin"]',
  };

  async function formatOverpassQuery(activityType, startPoint, endPoint) {
    const tagString = activityTypeTags[activityType];
    const overpassQuery = `[out:json][timeout:25];
            (
              way${tagString}(${startPoint.latitude},${startPoint.longitude},${endPoint.latitude},${endPoint.longitude});
            );
            (._;>;);
            out skel qt;`;

    return overpassQuery;
  }

  try {
    const { activityType, startPoint, endPoint } = req.body;

    if (!activityType || !startPoint || !endPoint) {
      next(InvalidRequestParamsError);
    }

    const overpassQuery = await formatOverpassQuery(
      activityType,
      startPoint,
      endPoint,
    );

    // console.log("overpassQuery", overpassQuery);

    const response = await axios.post(overpassUrl, overpassQuery, {
      headers: { 'Content-Type': 'text/plain' },
    });

    // console.log("response", response);

    if (response.status === 200) {
      const responseFormat = response.data;
      const geojsonData = osmtogeojson(responseFormat);
      res.locals.data = geojsonData;
      responseHandler(res);
    } else {
      console.log(response.status, response.statusText);
      next(ErrorProcessingOverpassError);
    }
  } catch (error) {
    next(ErrorRetrievingOverpassError);
  }
};
