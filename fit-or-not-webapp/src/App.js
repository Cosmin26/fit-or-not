import React, {Component} from 'react';
import KerasJS from 'keras-js';
import './App.css';

import ndarray from 'ndarray';
import ops from 'ndarray-ops';
import loadImage from 'blueimp-load-image';

import {food101topK} from './utils';

// const loadImage = window.loadImage;

const mapProb = (prob) => {
    if (prob * 100 < 2) {
        return '2%';
    } else {
        return (prob * 100 + '%');
    }
}

const Predictions = ({topK}) => {
    return (
        <table className='predictions'>
            <tbody>
            <tr>
                <th className='th'>Prediction</th>
                <th>Probability</th>
            </tr>
            {topK.map((pred, i) =>
                <tr key={i}>
                    <td className='predLabel'>{pred.name}</td>
                    <td className='predPercent'>
                        <span className='predPercentLabel'>{(pred.probability * 100).toFixed(5)}%</span>
                        <div className='predBar' style={{width: mapProb(pred.probability)}}/>
                    </td>
                </tr>
            )}
            </tbody>
        </table>
    );
}

class App extends Component {

    constructor() {
        super();

        let hasWebgl = false;
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        // Report the result.
        if (gl && gl instanceof WebGLRenderingContext) {
            hasWebgl = true;
        } else {
            hasWebgl = false;
        }
        console.log('WebGL enabled:', hasWebgl);

        this.urlInput = null;
        this.state = {
            model: null,
            modelLoaded: false,
            modelLoading: false,
            modelRunning: false,
            imageLoadingError: false,
            loadingPercent: 0,
            classifyPercent: 0,
            topK: null,
            hasWebgl,
            url: 'https://amp.businessinsider.com/images/5a7aea7b7101ad094069a41b-750-563.png'
        };
    }

    loadModel = () => {
        console.log('Loading Model');
        const model = new KerasJS.Model({
            filepath: "./model4.01-2.23.bin",
            filesystem: true,
            gpu: this.state.hasWebgl,
            layerCallPauses: true
        });


        const waitTillReady = model.ready();

        waitTillReady.then(() => {
            console.log('Model ready');
            this.setState({
                loadingPercent: 100,
                modelLoading: false,
                modelLoaded: true
            });

            setTimeout(() => this.loadImageToCanvas(this.state.url), 100);
        })
            .catch(err => {
                console.log('err', err);
            });

        this.setState({
            modelLoading: true,
            model
        });
    };

    loadImageToCanvas = (url) => {
        console.log('Loading Image');
        if (!url) {
            return;
        }

        this.setState({
            imageLoadingError: false,
            imageLoading: true,
            loadingPercent: 0,
            classifyPercent: 0,
            topK: null
        });

        loadImage(
            url,
            img => {
                if (img.type === 'error') {
                    console.log('Error loading image');
                    this.setState({
                        imageLoadingError: true,
                        imageLoading: false,
                        modelRunning: false,
                        url: null
                    });

                } else {
                    console.log('Image Loaded');
                    const ctx = document.getElementById('input-canvas').getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    this.setState({
                        imageLoadingError: false,
                        imageLoading: false,
                        modelRunning: true
                    });
                    setTimeout(() => {
                        this.runModel();
                    }, 1000)
                }
            },
            {
                maxWidth: 299,
                maxHeight: 299,
                cover: true,
                crop: true,
                canvas: true,
                crossOrigin: 'Anonymous'
            }
        );
    }

    runModel = () => {
        console.log('Running Model');

        const ctx = document.getElementById('input-canvas').getContext('2d');
        const imageData = ctx.getImageData(
            0,
            0,
            ctx.canvas.width,
            ctx.canvas.height
        );
        const {data, width, height} = imageData;

        // data processing
        // see https://github.com/fchollet/keras/blob/master/keras/applications/imagenet_utils.py
        // and https://github.com/fchollet/keras/blob/master/keras/applications/inception_v3.py
        let dataTensor = ndarray(new Float32Array(data), [width, height, 4]);
        let dataProcessedTensor = ndarray(new Float32Array(width * height * 3), [
            width,
            height,
            3
        ]);
        ops.divseq(dataTensor, 255);
        ops.subseq(dataTensor, 0.5);
        ops.mulseq(dataTensor, 2);
        ops.assign(
            dataProcessedTensor.pick(null, null, 0),
            dataTensor.pick(null, null, 0)
        );
        ops.assign(
            dataProcessedTensor.pick(null, null, 1),
            dataTensor.pick(null, null, 1)
        );
        ops.assign(
            dataProcessedTensor.pick(null, null, 2),
            dataTensor.pick(null, null, 2)
        );

        const inputData = {input_1: dataProcessedTensor.data};
        const predPromise = this.state.model.predict(inputData);

        // const totalLayers = Object.keys(this.state.model.modelDAG).length;
        // let interval = setInterval(() => {
        //     const completedLayers = this.state.model.layersWithResults.length;
        //     this.setState({
        //         classifyPercent: ((completedLayers / totalLayers) * 100).toFixed(2)
        //     });
        // }, 50);

        predPromise.then(outputData => {
            console.log(outputData);
            // clearInterval(interval);
            const preds = outputData['dense_1'];
            const topK = food101topK(preds);
            console.log(topK);
            this.setState({
                topK,
                modelRunning: false
            });
        });
    }

    classifyNewImage = () => {
        const newUrl = this.urlInput.value;
        this.setState({
            url: this.urlInput.value
        });
        console.log('classifying new image', newUrl);
        this.loadImageToCanvas(newUrl);
    }

    render() {
        const {
            loadingPercent,
            modelLoaded,
            modelLoading,
            modelRunning,
            imageLoading,
            imageLoadingError,
            classifyPercent,
            topK
        } = this.state;
        return (
            <div className="App">
                <h1>Food Classification!</h1>
                {!modelLoaded ?
                    <p className='intro'>
                        To get started, click the Load Model button to download the model that
                        we have built and exported using the Python notebook. The file may be
                        fairly large for some (85 MB), so keep that in mind if progress seems stuck.
                    </p>
                    : ''}
                <div className='init'>
                    {!modelLoaded && !modelLoading ? <button onClick={this.loadModel}>Load Model (85 MB)</button> : ''}
                    {!modelLoaded && modelLoading ?
                        <p className='loading'>LOADING MODEL: {loadingPercent}%</p>
                        : ''}
                    {modelLoaded && imageLoading ?
                        <p className='loading'>LOADING IMAGE</p>
                        : ''}
                    {modelLoaded && imageLoadingError ?
                        <p className='error'>ERROR LOADING IMAGE.<br/>TRY DIFFERENT URL</p>
                        : ''}
                    {modelLoaded && modelRunning ?
                        <p className='loading'>CLASSIFYING: {classifyPercent}%</p>
                        : ''}
                </div>
                <div className='interactive'>
                    {modelLoaded && !modelRunning && !imageLoading ?
                        <p>
                            Food Image URL: <input type='text' ref={(input) => {
                            this.urlInput = input;
                        }}/>
                            <br/><br/>
                            <button onClick={this.classifyNewImage}>Classify Image</button>
                        </p>
                        : ''}
                    <canvas id='input-canvas' width='299' height='299'/>
                    {topK ? <Predictions topK={topK}/> : ''}
                </div>
            </div>
        );
    }
}

export default App;
