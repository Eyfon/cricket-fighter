const innerHTML = (texts) => {
    return `
        <div class="logo">
            <span>Fogolin System</span>
        </div>
        
        <div class="controller">
            <div class="cross-btns">
                <div class="spike"></div>
                <div class="spike"></div>
                <div class="spike"></div>
                <div class="spike"></div>

                <div class="cross">
                    <div class="top-down">
                        <div class="button-top button-key-w control-btn dpad-btn dpad-up" id="controller_up" data-key="w">
                            <div class="button-stripe"></div>
                            <div class="button-stripe"></div>
                            <div class="button-stripe"></div>
                        </div>

                        <div class="button-bottom button-key-s control-btn dpad-btn dpad-down" id="controller_down" data-key="s">
                            <div class="button-stripe"></div>
                            <div class="button-stripe"></div>
                            <div class="button-stripe"></div>
                        </div>
                    </div>
        
                    <div class="left-right">
                        <div class="button-left button-key-a control-btn dpad-btn dpad-left" id="controller_left" data-key="a">
                            <div class="button-stripe"></div>
                            <div class="button-stripe"></div>
                            <div class="button-stripe"></div>
                        </div>
                        <div class="button-right button-key-d control-btn dpad-btn dpad-right" id="controller_right" data-key="d">
                            <div class="button-stripe"></div>
                            <div class="button-stripe"></div>
                            <div class="button-stripe"></div>
                        </div>
                    </div>
                    <div class="cross-middle-bumb"></div>
                </div>
            </div>
            
            <div class="action-btns">
                <div class="buttons-x-y">
                    <div class="control-btn btn-y" data-key="h"></div>
                    <div class="control-btn btn-x" data-key="g"></div>
                </div>
                <div class="buttons-a-b">
                    <div class="control-btn btn-b" data-key="w"></div>
                    <div class="control-btn btn-a" data-key="f"></div>
                </div>
            </div>
        </div>

        <div class="middle-btns">
            <div class="control-btn pill-btn select" data-key=" " data-text="${texts.controller.select}">
                <span></span>
            </div>
            <div class="control-btn pill-btn start" data-key="Enter" data-text="${texts.controller.start}">
                <span></span>
            </div>
        </div>
    `;
}

export default innerHTML;